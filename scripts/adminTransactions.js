/* ============================================================
   PERSYS — Admin Transactions
   Inline approve / reject per row + read-only View modal.
   ============================================================ */

const TX_API = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/transactions.php`;
const PROCESS_API = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/processTransaction.php`;
const FORM6_BASE = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/generateForm6.php`;

const ROWS_PER_PAGE = 15;

// ── Module state ─────────────────────────────────────────────────
let allRequests = [];
let filteredRows = [];
let currentPage = 1;
let filterStatus = 'all';
let filterType = 'all';

// Per-row pool selection state: { [requestId]: '1' | '2' | '' }
const rowPoolState = {};

// ── Bootstrap ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const authorized = await window.PERSYSAdminGuard.ready;
  if (!authorized) return;

  await loadTransactions();
  wireFilters();
  wireModal();
});

/* ═══════════════════════════════════════════════════════════════
   DATA LOADING
═══════════════════════════════════════════════════════════════ */

async function loadTransactions() {
  try {
    let response;
    try {
      response = await fetch(TX_API, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
    } catch (networkErr) {
      window.PERSYSApiErrors.handleNetworkError(networkErr);
      return;
    }

    const checked = await window.PERSYSApiErrors.handleResponse(response);
    if (!checked) return;

    const result = await checked.json();
    if (!result.success) throw new Error(result.message || 'Unable to load transactions.');

    const { admin, requests } = result.data;

    const usernameEl = document.getElementById('adminUsername');
    const roleEl = document.getElementById('adminRole');
    if (usernameEl) usernameEl.textContent = admin.username;
    if (roleEl) roleEl.textContent = admin.role_name;

    allRequests = requests || [];
    currentPage = 1;
    applyFilters();

  } catch (err) {
    console.error('TX load error:', err);
    const tbody = document.getElementById('txTableBody');
    if (tbody) {
      tbody.innerHTML =
        `<tr><td colspan="5" style="text-align:center;padding:28px;
           color:#9ca3af;font-style:italic;">
           Unable to load transactions. Please refresh.
         </td></tr>`;
    }
    const pg = document.getElementById('txPagination');
    if (pg) pg.hidden = true;
  }
}

/* ═══════════════════════════════════════════════════════════════
   FILTERS
═══════════════════════════════════════════════════════════════ */

function applyFilters() {
  const term = (document.getElementById('txSearch')?.value ?? '').trim().toLowerCase();

  filteredRows = allRequests.filter(r => {
    const name = buildName(r).toLowerCase();
    const type = (r.leave_type_name ?? '').toLowerCase();
    const status = (r.status ?? '').toLowerCase();
    const credit = (r.credit_type_name ?? 'not selected').toLowerCase();
    const reqNum = (r.request_number ?? '').toLowerCase();

    const matchSearch = !term ||
      [name, type, status, credit, reqNum].some(v => v.includes(term));
    const matchStatus = filterStatus === 'all' || status === filterStatus;
    const matchType = filterType === 'all' || credit.includes(filterType);

    return matchSearch && matchStatus && matchType;
  });

  currentPage = 1;
  renderPage();
}

/* ═══════════════════════════════════════════════════════════════
   TABLE RENDER
═══════════════════════════════════════════════════════════════ */

function renderPage() {
  const tbody = document.getElementById('txTableBody');
  const pagination = document.getElementById('txPagination');

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);

  const start = (currentPage - 1) * ROWS_PER_PAGE;
  renderTableRows(filteredRows.slice(start, start + ROWS_PER_PAGE), tbody, total);
  renderPagination(currentPage, totalPages, pagination);
}

function renderTableRows(rows, tbody, totalCount) {
  tbody.replaceChildren();

  if (totalCount === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.style.cssText = 'text-align:center;padding:32px;color:#9ca3af;font-style:italic;';
    td.textContent = allRequests.length > 0
      ? 'No transactions match the current filter.'
      : 'No leave requests found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(r => tbody.appendChild(buildRow(r)));
}

/* ── Build a single <tr> ────────────────────────────────────────── */

function buildRow(r) {
  const rid = r.leave_request_id;
  const statusLow = (r.status ?? 'pending').toLowerCase();
  const isPending = statusLow === 'pending';
  const leaveDays = Number(r.total_leave_days ?? 0);

  const tr = document.createElement('tr');
  tr.dataset.requestId = rid;
  tr.dataset.status = statusLow;

  /* ── Col 1: Employee ─────────────────────────────────────────── */
  const tdEmp = document.createElement('td');
  const empName = document.createElement('div');
  empName.className = 'tx-emp-name';
  empName.textContent = buildName(r);

  const empFiled = document.createElement('div');
  empFiled.className = 'tx-emp-sub';
  empFiled.textContent = `Filed: ${formatDate(r.date_filed)}`;

  tdEmp.append(empName, empFiled);

  /* ── Col 2: Leave Details ────────────────────────────────────── */
  const tdLeave = document.createElement('td');
  const leaveType = document.createElement('div');
  leaveType.className = 'tx-leave-type';
  leaveType.textContent = r.leave_type_name ?? '—';

  const leaveSub = document.createElement('div');
  leaveSub.className = 'tx-leave-sub';
  const startFmt = formatDate(r.start_datetime ? r.start_datetime.slice(0, 10) : '');
  const endFmt = formatDate(r.end_datetime ? r.end_datetime.slice(0, 10) : '');
  leaveSub.textContent = `${leaveDays} Days (${startFmt}–${endFmt})`;

  tdLeave.append(leaveType, leaveSub);

  /* ── Col 3: Deduct From ─────────────────────────────────────── */
  const tdDeduct = document.createElement('td');
  tdDeduct.className = 'tx-deduct-cell';

  if (isPending) {
    // Inline pool select
    const sel = document.createElement('select');
    sel.className = 'tx-pool-select';
    sel.dataset.requestId = rid;
    sel.setAttribute('aria-label', 'Select credit pool');

    [
      ['', 'Credit Types'],
      ['1', 'Local'],
      ['2', 'National'],
      ['3', 'Wellness'],
    ].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      sel.appendChild(opt);
    });

    // Restore previously chosen pool for this row
    sel.value = rowPoolState[rid] ?? '';

    // Balance hint below the select
    const hint = document.createElement('div');
    hint.className = 'tx-balance-hint';
    hint.dataset.rid = rid;

    // Render balance hint on load if pool already chosen
    renderBalanceHint(hint, sel.value, r, leaveDays);

    sel.addEventListener('change', () => {
      rowPoolState[rid] = sel.value;
      renderBalanceHint(hint, sel.value, r, leaveDays);

      // Enable / disable Approve button for this row
      const approveBtn = document.querySelector(
        `.tx-inline-approve[data-request-id="${rid}"]`
      );
      if (approveBtn) approveBtn.disabled = !sel.value;
    });

    tdDeduct.append(sel, hint);

  } else if (statusLow === 'approved') {
    const creditName = r.credit_type_name ?? 'Unknown pool';
    const deductSpan = document.createElement('span');
    deductSpan.className = 'tx-deduct-static tx-deduct-approved';
    deductSpan.textContent = `${creditName} (-${leaveDays.toFixed(2)} Days)`;
    tdDeduct.appendChild(deductSpan);

  } else {
    // Rejected
    const nd = document.createElement('span');
    nd.className = 'tx-deduct-static tx-deduct-rejected';
    nd.textContent = 'Not deducted';
    tdDeduct.appendChild(nd);
  }

  /* ── Col 4: Status ──────────────────────────────────────────── */
  const tdStatus = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = `tx-status-badge tx-status-${statusLow}`;

  const dot = document.createElement('span');
  dot.className = 'tx-status-dot-inline';
  dot.setAttribute('aria-hidden', 'true');
  badge.appendChild(dot);
  badge.appendChild(document.createTextNode(r.status ?? '—'));
  tdStatus.appendChild(badge);

  /* ── Col 5: Actions ─────────────────────────────────────────── */
  const tdActions = document.createElement('td');
  tdActions.className = 'tx-actions-cell';

  if (isPending) {
    // Approve button
    const approveBtn = document.createElement('button');
    approveBtn.type = 'button';
    approveBtn.className = 'tx-inline-approve';
    approveBtn.dataset.requestId = rid;
    approveBtn.disabled = !(rowPoolState[rid]);
    approveBtn.innerHTML =
      `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
       Approve`;
    approveBtn.addEventListener('click', () => inlineDecision(r, 'Approved'));

    // Reject button
    const rejectBtn = document.createElement('button');
    rejectBtn.type = 'button';
    rejectBtn.className = 'tx-inline-reject';
    rejectBtn.dataset.requestId = rid;
    rejectBtn.innerHTML =
      `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
       Disapproved`;
    rejectBtn.addEventListener('click', () => inlineDecision(r, 'Rejected'));

    // Form 6 button
    const form6Btn = makeForm6Btn(rid);

    // View (details) link
    const viewBtn = makeViewBtn(r);

    tdActions.append(approveBtn, rejectBtn, form6Btn, viewBtn);

  } else {
    // Approved or Rejected — View + Form 6 only
    const viewBtn = makeViewBtn(r);
    const form6Btn = makeForm6Btn(rid);
    tdActions.append(viewBtn, form6Btn);
  }

  tr.append(tdEmp, tdLeave, tdDeduct, tdStatus, tdActions);
  return tr;
}

/* ── Balance hint renderer ─────────────────────────────────────── */

function renderBalanceHint(hintEl, poolId, r, leaveDays) {
  if (!poolId) {
    hintEl.textContent = '';
    hintEl.className = 'tx-balance-hint';
    return;
  }

  const balance =
    poolId === '1' ? Number(r.local_balance) :
      poolId === '2' ? Number(r.national_balance) :
        poolId === '3' ? Number(r.wellness_balance) : NaN;

  if (!Number.isFinite(balance)) {
    hintEl.textContent = 'Balance unavailable';
    hintEl.className = 'tx-balance-hint';
    return;
  }

  const sufficient = balance >= leaveDays;
  hintEl.textContent = `Bal: ${balance.toFixed(2)} Days`;
  hintEl.className = `tx-balance-hint ${sufficient ? 'tx-bal-ok' : 'tx-bal-low'}`;
}

/* ── Shared button helpers ─────────────────────────────────────── */

function makeForm6Btn(rid) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tx-inline-form6';
  btn.title = 'Generate / Print Form 6';
  btn.innerHTML =
    `<svg viewBox="0 0 24 24" aria-hidden="true">
       <polyline points="6 9 6 2 18 2 18 9"/>
       <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
       <rect x="6" y="14" width="12" height="8"/>
     </svg>
     Form 6`;
  btn.addEventListener('click', () => openForm6(rid, btn));
  return btn;
}

function makeViewBtn(r) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tx-inline-view';
  btn.textContent = 'View';
  btn.addEventListener('click', () => openModal(r));
  return btn;
}

/* ═══════════════════════════════════════════════════════════════
   INLINE DECISION (Approve / Reject from table row)
═══════════════════════════════════════════════════════════════ */

async function inlineDecision(r, targetStatus) {
  const rid = r.leave_request_id;
  const creditTypeId = rowPoolState[rid] ?? '';

  if (targetStatus === 'Approved' && !creditTypeId) {
    alert('Please select a credit pool before approving.');
    return;
  }

  const confirmMsg = targetStatus === 'Approved'
    ? `Approve this request and deduct ${r.total_leave_days} days from the selected credit pool?`
    : 'Reject this leave request? No credits will be deducted.';

  if (!window.confirm(confirmMsg)) return;

  // Disable all action buttons on this row while processing
  const tr = document.querySelector(`tr[data-request-id="${rid}"]`);
  const btns = tr ? tr.querySelectorAll('button') : [];
  btns.forEach(b => { b.disabled = true; });

  try {
    let response;
    try {
      response = await fetch(PROCESS_API, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          request_id: rid,
          target_status: targetStatus,
          credit_type_id: creditTypeId || undefined,
        })
      });
    } catch (networkErr) {
      window.PERSYSApiErrors.handleNetworkError(networkErr);
      btns.forEach(b => { b.disabled = false; });
      return;
    }

    const checked = await window.PERSYSApiErrors.handleResponse(response);
    if (!checked) {
      btns.forEach(b => { b.disabled = false; });
      return;
    }

    const result = await checked.json();

    if (!result.success) {
      alert(result.message || 'Unable to save the decision.');
      btns.forEach(b => { b.disabled = false; });
      return;
    }

    // Update the in-memory record so the row re-renders correctly
    // without a full network reload
    const idx = allRequests.findIndex(x => x.leave_request_id === rid);
    if (idx !== -1) {
      allRequests[idx].status = targetStatus;

      if (targetStatus === 'Approved') {
        // Map credit_type_id back to a name
        allRequests[idx].credit_type_id = creditTypeId;
        allRequests[idx].credit_type_name = creditTypeId === '1'
          ? 'Local'
          : 'National';
      }

      // Clear the pool choice for this row (it's finalised now)
      delete rowPoolState[rid];
    }

    // Re-render from filtered slice (preserves page + filters)
    applyFilters();

  } catch (err) {
    console.error('inlineDecision error:', err);
    alert('A server error occurred. Please try again.');
    btns.forEach(b => { b.disabled = false; });
  }
}

/* ═══════════════════════════════════════════════════════════════
   FORM 6 (Ad-blocker & Popup-blocker resilient Fetch + Blob PDF)
═══════════════════════════════════════════════════════════════ */

async function openForm6(rid, triggerBtn = null) {
  const r = allRequests.find(x => String(x.leave_request_id) === String(rid));
  const statusLow = String(r?.status ?? '').toLowerCase();
  if (statusLow === 'rejected' || statusLow === 'disapproved') {
    alert('Form 6 is unavailable for rejected requests.');
    return;
  }

  const originalHtml = triggerBtn ? triggerBtn.innerHTML : '';
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.textContent = 'Generating...';
  }

  try {
    const url = `${FORM6_BASE}?request_id=${encodeURIComponent(rid)}`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/pdf' }
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(errText.trim() || `Unable to generate Form 6 (HTTP ${response.status}).`);
    }

    const rawBlob = await response.blob();
    const pdfBlob = new Blob([rawBlob], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(pdfBlob);

    const safeReqNum = String(r?.request_number || rid).replace(/[^A-Za-z0-9_-]/g, '_');
    const filename = `Form6_${safeReqNum}.pdf`;

    // Try opening the Blob URL in a new tab for preview/printing
    const newWin = window.open(blobUrl, '_blank');

    // If an ad blocker or popup blocker blocked window.open, trigger direct download
    if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // Revoke the temporary Blob URL after 60 seconds
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

  } catch (err) {
    console.error('Form 6 generation error:', err);
    alert(err.message || 'Unable to generate Form 6. Please try again.');
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = originalHtml;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   READ-ONLY VIEW MODAL
═══════════════════════════════════════════════════════════════ */

function wireModal() {
  const overlay = document.getElementById('txModalOverlay');
  const closeBtn = document.getElementById('txModalClose');
  const modalCloseFooter = document.getElementById('txModalCloseFooter');
  const modalForm6Btn = document.getElementById('txModalForm6');

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (modalCloseFooter) modalCloseFooter.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
  });

  if (modalForm6Btn) {
    modalForm6Btn.addEventListener('click', () => {
      const ridEl = document.getElementById('txModalRequestId');
      if (ridEl && ridEl.value) openForm6(ridEl.value, modalForm6Btn);
    });
  }
}

function openModal(r) {
  const overlay = document.getElementById('txModalOverlay');
  const modal = document.getElementById('txModal');
  const statusLow = (r.status ?? 'pending').toLowerCase();

  modal.dataset.status = statusLow;

  // Store request id for Form 6 button
  const ridEl = document.getElementById('txModalRequestId');
  if (ridEl) ridEl.value = r.leave_request_id;

  // Populate read-only fields
  setText('txRequestNumber', r.request_number);
  setText('txEmployeeName', buildName(r));
  setText('txEmployeeNumber', r.employee_number);
  setText('txPosition', r.position);
  setText('txLeaveType', r.leave_type_name);
  setText('txReason', r.reason_details || 'Not provided');
  setText('txStartDate', formatDateLong(r.start_datetime));
  setText('txEndDate', formatDateLong(r.end_datetime));
  setText('txTotalDays', `${r.total_leave_days} Days`);
  setText('txCreditType', r.credit_type_name ?? 'Not selected');

  // Credit balance / deduction (read-only computed display)
  const creditId = r.credit_type_id;
  if (creditId && statusLow === 'approved') {
    const balance =
      creditId == 1 ? Number(r.local_balance) :
        creditId == 2 ? Number(r.national_balance) :
          creditId == 3 ? Number(r.wellness_balance) : NaN;
    const leaveDays = Number(r.total_leave_days ?? 0);
    setText('txCurrentBalance', Number.isFinite(balance) ? `${balance.toFixed(2)} Days` : '—');
    setText('txDeductionAmount', `- ${leaveDays.toFixed(2)} Days`);
    setText('txRemainingBalance', Number.isFinite(balance) ? `${(balance - leaveDays).toFixed(2)} Days` : '—');
  } else {
    setText('txCurrentBalance', '—');
    setText('txDeductionAmount', '—');
    setText('txRemainingBalance', '—');
  }

  // Audit trail
  setText('txReviewedBy', r.reviewer_name || '—');
  setText('txReviewedAt', r.reviewed_at ? formatDateLong(r.reviewed_at) : '—');

  // Footer status badge
  const statusBadge = document.getElementById('txModalStatusBadge');
  if (statusBadge) {
    statusBadge.textContent = `Status: ${r.status ?? '—'}`;
    statusBadge.className = `tx-modal-status-pill tx-status-${statusLow}`;
  }

  // Form 6 button — hidden for rejected
  const form6Btn = document.getElementById('txModalForm6');
  if (form6Btn) {
    form6Btn.style.display = statusLow === 'rejected' ? 'none' : 'inline-flex';
  }

  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  modal.focus();
}

function closeModal() {
  document.getElementById('txModalOverlay').classList.remove('is-open');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════════════════════════
   PAGINATION
═══════════════════════════════════════════════════════════════ */

function renderPagination(page, totalPages, container) {
  container.replaceChildren();

  if (totalPages <= 1) { container.hidden = true; return; }
  container.hidden = false;

  const total = filteredRows.length;
  const start = (page - 1) * ROWS_PER_PAGE + 1;
  const end = Math.min(page * ROWS_PER_PAGE, total);

  const info = document.createElement('span');
  info.className = 'tx-pagination-info';
  info.textContent = `Showing ${start}–${end} of ${total}`;

  const group = document.createElement('div');
  group.className = 'tx-pagination-btns';

  group.append(
    makePagBtn('← Prev', page <= 1, () => { currentPage--; renderPage(); }),
    ...buildPageRange(page, totalPages).map(p => {
      if (p === '…') {
        const el = document.createElement('span');
        el.className = 'tx-page-ellipsis'; el.textContent = '…';
        return el;
      }
      return makePagBtn(String(p), false, () => { currentPage = p; renderPage(); }, p === page);
    }),
    makePagBtn('Next →', page >= totalPages, () => { currentPage++; renderPage(); })
  );

  container.append(info, group);
}

function buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  pages.push(1);
  if (left > 2) pages.push('…');
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

function makePagBtn(label, disabled, onClick, isActive = false) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.disabled = disabled;
  btn.className = 'tx-page-btn' + (isActive ? ' tx-page-btn--active' : '');
  if (!disabled) btn.addEventListener('click', onClick);
  return btn;
}

/* ═══════════════════════════════════════════════════════════════
   FILTER WIRING
═══════════════════════════════════════════════════════════════ */

function wireFilters() {
  const searchInput = document.getElementById('txSearch');
  if (searchInput) searchInput.addEventListener('input', applyFilters);

  const filterWraps = document.querySelectorAll('.tx-filter-wrap');

  filterWraps.forEach(wrap => {
    const btn = wrap.querySelector('.tx-filter-btn');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = wrap.classList.contains('is-open');
      filterWraps.forEach(w => {
        w.classList.remove('is-open');
        w.querySelector('.tx-filter-btn').setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        wrap.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.querySelectorAll('.tx-dropdown-panel button').forEach(opt => {
    opt.addEventListener('click', e => {
      e.stopPropagation();
      const wrap = opt.closest('.tx-filter-wrap');
      const value = opt.textContent.trim().toLowerCase();

      if (wrap.id === 'statusDropWrap') {
        filterStatus = value;
        document.getElementById('statusDropBtn').childNodes[0].textContent =
          'Status: ' + opt.textContent.trim() + ' ';
      }
      if (wrap.id === 'typeDropWrap') {
        filterType = value;
        document.getElementById('typeDropBtn').childNodes[0].textContent =
          'Type: ' + opt.textContent.trim() + ' ';
      }

      wrap.classList.remove('is-open');
      wrap.querySelector('.tx-filter-btn').setAttribute('aria-expanded', 'false');
      applyFilters();
    });
  });

  document.addEventListener('click', () => {
    filterWraps.forEach(w => {
      w.classList.remove('is-open');
      w.querySelector('.tx-filter-btn').setAttribute('aria-expanded', 'false');
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════ */

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '—';
}

function buildName(r) {
  return [r.first_name, r.middle_name, r.last_name]
    .filter(Boolean).join(' ').trim() || '—';
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateLong(value) {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
