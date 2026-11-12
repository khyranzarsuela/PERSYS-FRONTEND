/* ============================================================
   PERSYS — Admin Transactions
   Loads all leave requests, renders a paginated + filterable
   table, and handles the approve / reject modal workflow.
   ============================================================ */

const TX_API          = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/transactions.php`;
const PROCESS_API     = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/processTransaction.php`;
const FORM6_BASE      = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/generateForm6.php`;

const ROWS_PER_PAGE   = 15;

// ── Module state ─────────────────────────────────────────────────
let allRequests    = [];   // full dataset from API
let filteredRows   = [];   // after search + status + type filters
let currentPage    = 1;
let selectedRequest = null;

let filterStatus   = 'all';
let filterType     = 'all';

// ── DOM ready ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const authorized = await window.PERSYSAdminGuard.ready;
  if (!authorized) return;

  await loadTransactions();
  wireFilters();
  wireModal();
});

/* ── Main loader ────────────────────────────────────────────────── */

async function loadTransactions() {
  const tbody = document.getElementById('txTableBody');

  try {
    let response;

    try {
      response = await fetch(TX_API, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
    } catch (networkError) {
      window.PERSYSApiErrors.handleNetworkError(networkError);
      return;
    }

    const checked = await window.PERSYSApiErrors.handleResponse(response);
    if (!checked) return;

    const result = await checked.json();
    if (!result.success) throw new Error(result.message || 'Unable to load transactions.');

    const { admin, requests } = result.data;

    // Sidebar
    const usernameEl = document.getElementById('adminUsername');
    const roleEl     = document.getElementById('adminRole');
    if (usernameEl) usernameEl.textContent = admin.username;
    if (roleEl)     roleEl.textContent     = admin.role_name;

    allRequests  = requests || [];
    currentPage  = 1;
    applyFilters();

  } catch (error) {
    console.error('Transactions load error:', error);

    const tbody = document.getElementById('txTableBody');
    if (tbody) {
      tbody.innerHTML =
        `<tr><td colspan="6" style="text-align:center;padding:28px;color:#9ca3af;font-style:italic;">
           Unable to load transactions. Please refresh the page.
         </td></tr>`;
    }

    const pg = document.getElementById('txPagination');
    if (pg) pg.hidden = true;
  }
}

/* ── Filter + search ────────────────────────────────────────────── */

function applyFilters() {
  const searchInput = document.getElementById('txSearch');
  const term        = (searchInput?.value ?? '').trim().toLowerCase();

  filteredRows = allRequests.filter(r => {
    const name   = `${r.first_name ?? ''} ${r.middle_name ?? ''} ${r.last_name ?? ''}`.toLowerCase();
    const type   = (r.leave_type_name ?? '').toLowerCase();
    const date   = (r.date_filed ?? '').toLowerCase();
    const status = (r.status ?? '').toLowerCase();
    const credit = (r.credit_type_name ?? 'not selected').toLowerCase();
    const reqNum = (r.request_number ?? '').toLowerCase();

    const matchSearch = !term || [name, type, date, status, credit, reqNum]
      .some(v => v.includes(term));

    const matchStatus = filterStatus === 'all' || status === filterStatus;
    const matchType   = filterType   === 'all' || credit.includes(filterType);

    return matchSearch && matchStatus && matchType;
  });

  currentPage = 1;
  renderPage();
}

/* ── Table render ───────────────────────────────────────────────── */

function renderPage() {
  const tbody      = document.getElementById('txTableBody');
  const pagination = document.getElementById('txPagination');

  const total      = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  currentPage      = Math.min(Math.max(1, currentPage), totalPages);

  const start = (currentPage - 1) * ROWS_PER_PAGE;
  const slice = filteredRows.slice(start, start + ROWS_PER_PAGE);

  renderTableRows(slice, tbody, total);
  renderPagination(currentPage, totalPages, pagination);
}

function renderTableRows(rows, tbody, totalCount) {
  tbody.replaceChildren();

  if (totalCount === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.style.cssText = 'text-align:center;padding:32px;color:#9ca3af;font-style:italic;';
    td.textContent = filteredRows.length === 0 && allRequests.length > 0
      ? 'No transactions match the current filter.'
      : 'No leave requests found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const STATUS_DOT = {
    pending:  '#F5C518',
    approved: '#2ECC40',
    rejected: '#E31C1C',
  };

  rows.forEach(r => {
    const tr = document.createElement('tr');

    const statusLower = (r.status ?? 'pending').toLowerCase();
    tr.dataset.requestId  = r.leave_request_id;
    tr.dataset.status     = statusLower;
    tr.dataset.creditType = (r.credit_type_name ?? 'not selected').toLowerCase();

    // Employee name
    const tdEmp = document.createElement('td');
    tdEmp.textContent = buildName(r);

    // Leave Type
    const tdType = document.createElement('td');
    tdType.textContent = r.leave_type_name ?? '—';

    // Date Filed
    const tdDate = document.createElement('td');
    tdDate.textContent = formatDate(r.date_filed);

    // Service Credits
    const tdCredit = document.createElement('td');
    const days = Number(r.total_leave_days ?? 0);
    const creditName = r.credit_type_name ?? 'Not selected';
    tdCredit.textContent = `${days} ${days === 1 ? 'Day' : 'Days'} (${creditName})`;

    // Status with dot
    const tdStatus = document.createElement('td');
    const dot = document.createElement('span');
    dot.style.cssText =
      `display:inline-block;width:9px;height:9px;border-radius:50%;
       background:${STATUS_DOT[statusLower] ?? '#ccc'};
       margin-right:6px;vertical-align:middle;`;
    tdStatus.appendChild(dot);
    tdStatus.appendChild(document.createTextNode(r.status ?? '—'));

    // View button
    const tdAction = document.createElement('td');
    const viewBtn  = document.createElement('button');
    viewBtn.type      = 'button';
    viewBtn.className = 'tx-view-btn';
    viewBtn.textContent = 'View';
    viewBtn.addEventListener('click', () => openModal(r));
    tdAction.appendChild(viewBtn);

    tr.append(tdEmp, tdType, tdDate, tdCredit, tdStatus, tdAction);
    tbody.appendChild(tr);
  });
}

/* ── Pagination ─────────────────────────────────────────────────── */

function renderPagination(page, totalPages, container) {
  container.replaceChildren();

  if (totalPages <= 1) {
    container.hidden = true;
    return;
  }

  container.hidden = false;

  const total = filteredRows.length;
  const start = (page - 1) * ROWS_PER_PAGE + 1;
  const end   = Math.min(page * ROWS_PER_PAGE, total);

  const info = document.createElement('span');
  info.className   = 'tx-pagination-info';
  info.textContent = `Showing ${start}–${end} of ${total}`;

  const group = document.createElement('div');
  group.className = 'tx-pagination-btns';

  const prevBtn = makePagBtn('← Prev', page <= 1, () => {
    currentPage--;
    renderPage();
  });

  const pageRange = buildPageRange(page, totalPages);
  const pageButtons = pageRange.map(p => {
    if (p === '…') {
      const el = document.createElement('span');
      el.className   = 'tx-page-ellipsis';
      el.textContent = '…';
      return el;
    }
    return makePagBtn(String(p), false, () => {
      currentPage = p;
      renderPage();
    }, p === page);
  });

  const nextBtn = makePagBtn('Next →', page >= totalPages, () => {
    currentPage++;
    renderPage();
  });

  group.append(prevBtn, ...pageButtons, nextBtn);
  container.append(info, group);
}

function buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  const left  = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  pages.push(1);
  if (left > 2)          pages.push('…');
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

function makePagBtn(label, disabled, onClick, isActive = false) {
  const btn = document.createElement('button');
  btn.type        = 'button';
  btn.textContent = label;
  btn.disabled    = disabled;
  btn.className   = 'tx-page-btn' + (isActive ? ' tx-page-btn--active' : '');
  if (!disabled) btn.addEventListener('click', onClick);
  return btn;
}

/* ── Filter wiring ──────────────────────────────────────────────── */

function wireFilters() {
  // Search
  const searchInput = document.getElementById('txSearch');
  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  // Dropdown toggles
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

  // Dropdown option selection
  document.querySelectorAll('.tx-dropdown-panel button').forEach(opt => {
    opt.addEventListener('click', e => {
      e.stopPropagation();
      const wrap  = opt.closest('.tx-filter-wrap');
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

  // Click outside closes dropdowns
  document.addEventListener('click', () => {
    filterWraps.forEach(w => {
      w.classList.remove('is-open');
      w.querySelector('.tx-filter-btn').setAttribute('aria-expanded', 'false');
    });
  });
}

/* ── Modal wiring ───────────────────────────────────────────────── */

function wireModal() {
  const overlay      = document.getElementById('txModalOverlay');
  const modal        = document.getElementById('txModal');
  const closeBtn     = document.getElementById('txModalClose');
  const finalSelect  = document.getElementById('txFinalStatus');
  const creditGroup  = document.getElementById('txCreditPoolGroup');
  const deductPool   = document.getElementById('txDeductionPool');
  const saveBtn      = document.getElementById('txBtnSaveDecision');
  const form6Btn     = document.getElementById('txGenerateForm6');

  // Close handlers
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
  });

  // Final status select → show/hide credit pool
  finalSelect.addEventListener('change', () => {
    const isApproval = finalSelect.value === 'Approved';
    creditGroup.hidden = !isApproval;
    if (!isApproval) deductPool.value = '';
    updateCreditPreview();
  });

  // Credit pool select → update balance preview
  deductPool.addEventListener('change', updateCreditPreview);

  // Save decision
  if (saveBtn) saveBtn.addEventListener('click', saveDecision);

  // Generate Form 6
  if (form6Btn) {
    form6Btn.addEventListener('click', () => {
      if (!selectedRequest) return;
      if ((selectedRequest.status ?? '').toLowerCase() === 'rejected') {
        alert('Form 6 is unavailable for rejected requests.');
        return;
      }
      const url = `${FORM6_BASE}?request_id=${encodeURIComponent(selectedRequest.leave_request_id)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }
}

/* ── Open modal ─────────────────────────────────────────────────── */

function openModal(r) {
  selectedRequest = r;

  const modal      = document.getElementById('txModal');
  const overlay    = document.getElementById('txModalOverlay');
  const statusLow  = (r.status ?? 'pending').toLowerCase();
  const isPending  = statusLow === 'pending';

  modal.dataset.status = statusLow;

  // Populate fields
  setText('txRequestNumber', r.request_number);
  setText('txStatusText',    r.status);
  setText('txEmployeeName',  buildName(r));
  setText('txEmployeeNumber',r.employee_number);
  setText('txPosition',      r.position);
  setText('txLeaveType',     r.leave_type_name);
  setText('txReason',        r.reason_details || 'Not provided');
  setText('txStartDate',     formatDateLong(r.start_datetime));
  setText('txEndDate',       formatDateLong(r.end_datetime));
  setText('txTotalDays',     `${r.total_leave_days} Days`);
  setText('txCreditType',    r.credit_type_name ?? 'Not selected');

  // Audit trail
  const reviewerName = r.reviewer_name ?? '';
  const reviewedAt   = r.reviewed_at
    ? formatDateLong(r.reviewed_at)
    : '—';
  setText('txReviewedBy', reviewerName || '—');
  setText('txReviewedAt', reviewedAt);

  // Form 6 button — hidden for rejected
  const form6Btn = document.getElementById('txGenerateForm6');
  if (form6Btn) {
    form6Btn.style.display = statusLow === 'rejected' ? 'none' : 'inline-flex';
  }

  // Finalization controls
  const finalControls = document.getElementById('txFinalizationControls');
  const finalNote     = document.getElementById('txFinalizationNote');
  const finalSelect   = document.getElementById('txFinalStatus');
  const creditGroup   = document.getElementById('txCreditPoolGroup');
  const deductPool    = document.getElementById('txDeductionPool');

  finalControls.hidden = !isPending;
  if (finalNote) finalNote.hidden = isPending;

  // Reset controls for pending
  if (isPending) {
    finalSelect.value  = '';
    creditGroup.hidden = true;
    deductPool.value   = '';
    deductPool.disabled = false;
    resetCreditPreview();
  }

  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  document.getElementById('txModal').focus();
}

function closeModal() {
  document.getElementById('txModalOverlay').classList.remove('is-open');
  document.body.style.overflow = '';
  selectedRequest = null;
}

/* ── Credit preview ─────────────────────────────────────────────── */

function updateCreditPreview() {
  if (!selectedRequest) return;

  const poolId   = document.getElementById('txDeductionPool').value;
  const balanceEl    = document.getElementById('txCurrentBalance');
  const deductEl     = document.getElementById('txDeductionAmount');
  const remainingEl  = document.getElementById('txRemainingBalance');

  if (!poolId) {
    resetCreditPreview();
    return;
  }

  const balance  = poolId === '1'
    ? Number(selectedRequest.local_balance)
    : Number(selectedRequest.national_balance);

  const leaveDays = Number(selectedRequest.total_leave_days);

  if (!Number.isFinite(balance) || !Number.isFinite(leaveDays)) {
    if (balanceEl)   balanceEl.textContent   = 'Unable to calculate';
    if (deductEl)    deductEl.textContent    = '—';
    if (remainingEl) remainingEl.textContent = '—';
    return;
  }

  const remaining = balance - leaveDays;

  if (balanceEl)   balanceEl.textContent   = `${balance.toFixed(2)} Credits`;
  if (deductEl) {
    deductEl.innerHTML =
      `<span style="color:#E31C1C;">- ${leaveDays.toFixed(2)} Credits</span>`;
  }
  if (remainingEl) {
    remainingEl.textContent   = `${remaining.toFixed(2)} Credits`;
    remainingEl.style.color   = remaining < 0 ? '#E31C1C' : '#555';
  }
}

function resetCreditPreview() {
  setText('txCurrentBalance',  'Select a credit pool');
  setText('txDeductionAmount', '—');
  setText('txRemainingBalance','—');
  const remEl = document.getElementById('txRemainingBalance');
  if (remEl) remEl.style.color = '#555';
}

/* ── Save decision (Approve / Reject) ───────────────────────────── */

async function saveDecision() {
  if (!selectedRequest) return;

  const targetStatus  = document.getElementById('txFinalStatus').value;
  const creditTypeId  = document.getElementById('txDeductionPool').value;
  const saveBtn       = document.getElementById('txBtnSaveDecision');

  if (!['Approved', 'Rejected'].includes(targetStatus)) {
    alert('Please select Approved or Rejected.');
    return;
  }

  if (targetStatus === 'Approved' && !creditTypeId) {
    alert('Please select a service credit pool before approving.');
    return;
  }

  const confirmMsg = targetStatus === 'Approved'
    ? 'Confirm approval and deduct service credits?'
    : 'Confirm rejection? No credits will be deducted.';

  if (!window.confirm(confirmMsg)) return;

  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

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
          request_id:    selectedRequest.leave_request_id,
          target_status: targetStatus,
          credit_type_id: creditTypeId || undefined,
        })
      });
    } catch (networkError) {
      window.PERSYSApiErrors.handleNetworkError(networkError);
      return;
    }

    const checked = await window.PERSYSApiErrors.handleResponse(response);
    if (!checked) return;

    const result = await checked.json();

    if (!result.success) {
      alert(result.message || 'Unable to save the decision.');
      return;
    }

    alert(result.message || 'Decision saved successfully.');
    closeModal();

    // Reload transaction list
    await loadTransactions();

  } catch (error) {
    console.error('saveDecision error:', error);
    alert('A server error occurred. Please try again.');
  } finally {
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save Final Decision';
  }
}

/* ── Utilities ──────────────────────────────────────────────────── */

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '—';
}

function buildName(r) {
  return [r.first_name, r.middle_name, r.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || '—';
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
