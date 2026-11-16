/* ============================================================
   PERSYS — Admin Transaction History
   Toggle between Leave Request History (Approved & Disapproved)
   and Service Credit Upload History, sorted newest first.
   ============================================================ */

const TX_API = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/transactions.php`;
const SC_SUMMARY_API = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/serviceCredits/summary.php`;
const SC_BATCH_RECIPIENTS_API = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/serviceCredits/batchRecipients.php`;
const FORM6_BASE = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/generateForm6.php`;

const ROWS_PER_PAGE = 15;
const SC_RECIPIENTS_PER_PAGE = 5;

// Active view mode: 'leave-requests' | 'service-credits'
let activeMode = 'leave-requests';

let leaveHistoryRecords = [];
let scUploadHistoryRecords = [];

let filteredRows = [];
let currentPage = 1;
let filterType = 'all';
let filterStatus = 'all';

// State for Service Credit Recipients modal
let scModalRecipients = [];
let scModalPage = 1;

document.addEventListener('DOMContentLoaded', async () => {
  const authorized = await window.PERSYSAdminGuard.ready;
  if (!authorized) return;

  wireModeToggles();
  wireFilters();
  wireModal();
  wireScRecipientsModal();
  populateFilterDropdowns();

  await Promise.all([
    loadLeaveHistory(),
    loadServiceCreditHistory()
  ]);

  applyFilters();
});

/* ═══════════════════════════════════════════════════════════════
   DATA LOADING
═══════════════════════════════════════════════════════════════ */

async function loadLeaveHistory() {
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
    if (!result.success) throw new Error(result.message || 'Unable to load leave request history.');

    const { admin, requests } = result.data || {};

    if (admin) {
      const usernameEl = document.getElementById('adminUsername');
      const roleEl = document.getElementById('adminRole');
      if (usernameEl) usernameEl.textContent = admin.username;
      if (roleEl) roleEl.textContent = admin.role_name;
    }

    // Keep only Approved and Rejected (Disapproved) requests, sorted newest first
    const finalized = (requests || []).filter(r => {
      const st = String(r.status || '').toLowerCase();
      return st === 'approved' || st === 'rejected' || st === 'disapproved';
    });

    finalized.sort((a, b) => {
      const timeA = parseTimestamp(a.reviewed_at) || parseTimestamp(a.date_filed);
      const timeB = parseTimestamp(b.reviewed_at) || parseTimestamp(b.date_filed);
      if (timeB !== timeA) return timeB - timeA;
      return Number(b.leave_request_id || 0) - Number(a.leave_request_id || 0);
    });

    leaveHistoryRecords = finalized;
  } catch (err) {
    console.error('Leave history load error:', err);
    leaveHistoryRecords = [];
  }
}

async function loadServiceCreditHistory() {
  try {
    let response;
    try {
      response = await fetch(SC_SUMMARY_API, {
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
    if (!result.success) throw new Error(result.message || 'Unable to load service credit history.');

    const data = result.data || {};

    if (data.admin) {
      const usernameEl = document.getElementById('adminUsername');
      const roleEl = document.getElementById('adminRole');
      if (usernameEl) usernameEl.textContent = data.admin.username;
      if (roleEl) roleEl.textContent = data.admin.role_name;
    }

    const uploads = Array.isArray(data.upload_history) ? [...data.upload_history] : [];

    // Sort newest upload at the top
    uploads.sort((a, b) => {
      const timeA = parseTimestamp(a.uploaded_at) || parseTimestamp(a.posted_at);
      const timeB = parseTimestamp(b.uploaded_at) || parseTimestamp(b.posted_at);
      if (timeB !== timeA) return timeB - timeA;
      return Number(b.upload_batch_id || 0) - Number(a.upload_batch_id || 0);
    });

    scUploadHistoryRecords = uploads;
  } catch (err) {
    console.error('Service credit history load error:', err);
    scUploadHistoryRecords = [];
  }
}

function parseTimestamp(val) {
  if (!val) return 0;
  const d = new Date(String(val).replace(' ', 'T'));
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/* ═══════════════════════════════════════════════════════════════
   MODE TOGGLE (Show Service Credits vs Show Leave Requests)
═══════════════════════════════════════════════════════════════ */

function wireModeToggles() {
  const btnSc = document.getElementById('btnShowServiceCredits');
  const btnLr = document.getElementById('btnShowLeaveRequests');

  btnSc?.addEventListener('click', () => setMode('service-credits'));
  btnLr?.addEventListener('click', () => setMode('leave-requests'));
}

function setMode(mode) {
  if (mode !== 'service-credits' && mode !== 'leave-requests') return;
  activeMode = mode;

  const isSc = mode === 'service-credits';

  const btnSc = document.getElementById('btnShowServiceCredits');
  const btnLr = document.getElementById('btnShowLeaveRequests');
  const titleEl = document.getElementById('historyTableTitle');
  const leaveWrap = document.getElementById('leaveHistoryTableWrap');
  const scWrap = document.getElementById('scHistoryTableWrap');

  if (btnSc) {
    btnSc.classList.toggle('is-active', isSc);
    btnSc.setAttribute('aria-selected', String(isSc));
  }
  if (btnLr) {
    btnLr.classList.toggle('is-active', !isSc);
    btnLr.setAttribute('aria-selected', String(!isSc));
  }

  if (titleEl) {
    titleEl.textContent = isSc
      ? 'Service Credit Upload History'
      : 'Leave Request History';
  }

  if (leaveWrap) leaveWrap.hidden = isSc;
  if (scWrap) scWrap.hidden = !isSc;

  // Reset dropdown filters on mode switch
  filterType = 'all';
  filterStatus = 'all';
  populateFilterDropdowns();
  currentPage = 1;
  applyFilters();
}

/* ═══════════════════════════════════════════════════════════════
   FILTERS & DROPDOWNS
═══════════════════════════════════════════════════════════════ */

function populateFilterDropdowns() {
  const typePanel = document.getElementById('historyTypeDropPanel');
  const statusPanel = document.getElementById('historyStatusDropPanel');
  const typeLabel = document.getElementById('historyTypeDropLabel');
  const statusLabel = document.getElementById('historyStatusDropLabel');

  if (typeLabel) typeLabel.textContent = 'Type: All';
  if (statusLabel) statusLabel.textContent = 'Status: All';

  const typeOptions = activeMode === 'leave-requests'
    ? [
        { value: 'all', label: 'All' },
        { value: 'local', label: 'Local' },
        { value: 'national', label: 'National' },
        { value: 'wellness', label: 'Wellness' }
      ]
    : [
        { value: 'all', label: 'All' },
        { value: 'excel', label: 'Excel Upload (.xlsx)' }
      ];

  const statusOptions = activeMode === 'leave-requests'
    ? [
        { value: 'all', label: 'All' },
        { value: 'approved', label: 'Approved' },
        { value: 'disapproved', label: 'Disapproved' }
      ]
    : [
        { value: 'all', label: 'All' },
        { value: 'posted', label: 'POSTED' }
      ];

  if (typePanel) {
    typePanel.replaceChildren();
    typeOptions.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'option');
      btn.dataset.value = opt.value;
      btn.textContent = opt.label;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        filterType = opt.value;
        if (typeLabel) typeLabel.textContent = `Type: ${opt.label}`;
        closeAllDropdowns();
        applyFilters();
      });
      typePanel.appendChild(btn);
    });
  }

  if (statusPanel) {
    statusPanel.replaceChildren();
    statusOptions.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'option');
      btn.dataset.value = opt.value;
      btn.textContent = opt.label;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        filterStatus = opt.value;
        if (statusLabel) statusLabel.textContent = `Status: ${opt.label}`;
        closeAllDropdowns();
        applyFilters();
      });
      statusPanel.appendChild(btn);
    });
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.tx-filter-wrap').forEach(w => {
    w.classList.remove('is-open');
    w.querySelector('.tx-filter-btn')?.setAttribute('aria-expanded', 'false');
  });
}

function wireFilters() {
  const searchInput = document.getElementById('historySearch');
  if (searchInput) searchInput.addEventListener('input', applyFilters);

  const filterWraps = document.querySelectorAll('.tx-filter-wrap');
  filterWraps.forEach(wrap => {
    const btn = wrap.querySelector('.tx-filter-btn');
    btn?.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = wrap.classList.contains('is-open');
      closeAllDropdowns();
      if (!wasOpen) {
        wrap.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', closeAllDropdowns);
}

function applyFilters() {
  const term = (document.getElementById('historySearch')?.value ?? '').trim().toLowerCase();

  if (activeMode === 'leave-requests') {
    filteredRows = leaveHistoryRecords.filter(r => {
      const name = buildName(r).toLowerCase();
      const leaveType = String(r.leave_type_name ?? '').toLowerCase();
      const rawStatus = String(r.status ?? '').toLowerCase();
      const displayStatus = rawStatus === 'rejected' ? 'disapproved' : rawStatus;
      const credit = String(r.credit_type_name ?? 'not deducted').toLowerCase();
      const reqNum = String(r.request_number ?? '').toLowerCase();

      const matchSearch = !term ||
        [name, leaveType, displayStatus, rawStatus, credit, reqNum].some(v => v.includes(term));

      const matchStatus = filterStatus === 'all' || displayStatus === filterStatus;
      const matchType = filterType === 'all' || credit.includes(filterType) || leaveType.includes(filterType);

      return matchSearch && matchStatus && matchType;
    });
  } else {
    filteredRows = scUploadHistoryRecords.filter(rec => {
      const fileName = String(rec.file_name ?? '').toLowerCase();
      const uploadedBy = String(rec.uploaded_by_name ?? '').toLowerCase();
      const status = String(rec.status ?? '').toLowerCase();
      const uploadedAt = String(rec.uploaded_at ?? '').toLowerCase();
      const postedAt = String(rec.posted_at ?? '').toLowerCase();

      const matchSearch = !term ||
        [fileName, uploadedBy, status, uploadedAt, postedAt].some(v => v.includes(term));

      const matchStatus = filterStatus === 'all' || status === filterStatus;
      const matchType = filterType === 'all' || (filterType === 'excel' && fileName.includes('.xls'));

      return matchSearch && matchStatus && matchType;
    });
  }

  currentPage = 1;
  renderPage();
}

/* ═══════════════════════════════════════════════════════════════
   TABLE RENDER
═══════════════════════════════════════════════════════════════ */

function renderPage() {
  const pagination = document.getElementById('historyPagination');
  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);

  const start = (currentPage - 1) * ROWS_PER_PAGE;
  const pageItems = filteredRows.slice(start, start + ROWS_PER_PAGE);

  if (activeMode === 'leave-requests') {
    const tbody = document.getElementById('leaveHistoryTableBody');
    renderLeaveHistoryRows(pageItems, tbody, total);
  } else {
    const tbody = document.getElementById('scHistoryTableBody');
    renderScHistoryRows(pageItems, tbody, total);
  }

  renderPagination(currentPage, totalPages, pagination);
}

function renderLeaveHistoryRows(rows, tbody, totalCount) {
  if (!tbody) return;
  tbody.replaceChildren();

  if (totalCount === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.style.cssText = 'text-align:center;padding:32px;color:#9ca3af;font-style:italic;';
    td.textContent = leaveHistoryRecords.length > 0
      ? 'No leave request history matches the current filter.'
      : 'No approved or disapproved leave requests found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(r => tbody.appendChild(buildLeaveHistoryRow(r)));
}

function buildLeaveHistoryRow(r) {
  const rid = r.leave_request_id;
  const rawStatusLow = String(r.status ?? '').toLowerCase();
  const isApproved = rawStatusLow === 'approved';
  const displayStatusText = isApproved ? 'Approved' : 'Disapproved';
  const badgeStatusClass = isApproved ? 'approved' : 'rejected';
  const leaveDays = Number(r.total_leave_days ?? 0);

  const tr = document.createElement('tr');
  tr.dataset.requestId = rid;

  // Col 1: Employee
  const tdEmp = document.createElement('td');
  const empName = document.createElement('div');
  empName.className = 'tx-emp-name';
  empName.textContent = buildName(r);

  const empFiled = document.createElement('div');
  empFiled.className = 'tx-emp-sub';
  empFiled.textContent = `Filed: ${formatDate(r.date_filed)}`;
  tdEmp.append(empName, empFiled);

  // Col 2: Leave Details
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

  // Col 3: Deduct From
  const tdDeduct = document.createElement('td');
  if (isApproved) {
    const creditName = r.credit_type_name ?? 'Unknown pool';
    const deductSpan = document.createElement('span');
    deductSpan.className = 'tx-deduct-static tx-deduct-approved';
    deductSpan.textContent = `${creditName} (-${leaveDays.toFixed(2)} Days)`;
    tdDeduct.appendChild(deductSpan);
  } else {
    const nd = document.createElement('span');
    nd.className = 'tx-deduct-static tx-deduct-rejected';
    nd.textContent = 'Not deducted';
    tdDeduct.appendChild(nd);
  }

  // Col 4: Status
  const tdStatus = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = `tx-status-badge tx-status-${badgeStatusClass}`;

  const dot = document.createElement('span');
  dot.className = 'tx-status-dot-inline';
  dot.setAttribute('aria-hidden', 'true');
  badge.appendChild(dot);
  badge.appendChild(document.createTextNode(displayStatusText));
  tdStatus.appendChild(badge);

  // Col 5: Actions (View + Form 6)
  const tdActions = document.createElement('td');
  tdActions.className = 'tx-actions-cell';

  const viewBtn = document.createElement('button');
  viewBtn.type = 'button';
  viewBtn.className = 'tx-inline-view';
  viewBtn.textContent = 'View';
  viewBtn.addEventListener('click', () => openModal(r));

  const form6Btn = document.createElement('button');
  form6Btn.type = 'button';
  form6Btn.className = 'tx-inline-form6';
  form6Btn.title = 'Generate / Print Form 6';
  form6Btn.innerHTML =
    `<svg viewBox="0 0 24 24" aria-hidden="true">
       <polyline points="6 9 6 2 18 2 18 9"/>
       <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
       <rect x="6" y="14" width="12" height="8"/>
     </svg>
     Form 6`;
  form6Btn.addEventListener('click', () => openForm6(r, form6Btn));

  tdActions.append(viewBtn, form6Btn);

  tr.append(tdEmp, tdLeave, tdDeduct, tdStatus, tdActions);
  return tr;
}

function renderScHistoryRows(rows, tbody, totalCount) {
  if (!tbody) return;
  tbody.replaceChildren();

  if (totalCount === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.style.cssText = 'text-align:center;padding:32px;color:#9ca3af;font-style:italic;';
    td.textContent = scUploadHistoryRecords.length > 0
      ? 'No upload records match the current filter.'
      : 'No service credit upload records found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(rec => tbody.appendChild(buildScHistoryRow(rec)));
}

function buildScHistoryRow(rec) {
  const tr = document.createElement('tr');

  // Col 1: Upload Date
  const tdUploadDate = document.createElement('td');
  tdUploadDate.textContent = rec.uploaded_at || '—';

  // Col 2: File Name
  const tdFileName = document.createElement('td');
  const fileSpan = document.createElement('span');
  fileSpan.className = 'sc-history-filename';
  fileSpan.textContent = rec.file_name || '—';
  tdFileName.appendChild(fileSpan);

  // Col 3: Uploaded By
  const tdUploadedBy = document.createElement('td');
  tdUploadedBy.textContent = rec.uploaded_by_name || '—';

  // Col 4: Records
  const tdRecords = document.createElement('td');
  tdRecords.textContent = String(rec.record_count ?? 0);

  // Col 5: Status
  const tdStatus = document.createElement('td');
  const statusPill = document.createElement('span');
  statusPill.className = 'sc-status-posted';
  statusPill.textContent = String(rec.status || 'POSTED').toUpperCase();
  tdStatus.appendChild(statusPill);

  // Col 6: Posted Date
  const tdPostedDate = document.createElement('td');
  tdPostedDate.textContent = rec.posted_at || '—';

  // Col 7: Actions (View button opens Service Credit Recipients modal)
  const tdActions = document.createElement('td');
  tdActions.className = 'tx-actions-cell';
  const viewBtn = document.createElement('button');
  viewBtn.type = 'button';
  viewBtn.className = 'tx-inline-view';
  viewBtn.textContent = 'View';
  viewBtn.addEventListener('click', () => openScRecipientsModal(rec));
  tdActions.appendChild(viewBtn);

  tr.append(
    tdUploadDate,
    tdFileName,
    tdUploadedBy,
    tdRecords,
    tdStatus,
    tdPostedDate,
    tdActions
  );

  return tr;
}

/* ═══════════════════════════════════════════════════════════════
   SERVICE CREDIT RECIPIENTS MODAL
═══════════════════════════════════════════════════════════════ */

function wireScRecipientsModal() {
  const overlay = document.getElementById('scRecipientsModalOverlay');
  const closeBtn = document.getElementById('scRecipientsCloseBtn');
  const footerCloseBtn = document.getElementById('scRecipientsFooterCloseBtn');
  const prevBtn = document.getElementById('scRecipientsPrevBtn');
  const nextBtn = document.getElementById('scRecipientsNextBtn');

  closeBtn?.addEventListener('click', closeScRecipientsModal);
  footerCloseBtn?.addEventListener('click', closeScRecipientsModal);
  overlay?.addEventListener('click', e => {
    if (e.target === overlay) closeScRecipientsModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay?.classList.contains('is-open')) {
      closeScRecipientsModal();
    }
  });

  prevBtn?.addEventListener('click', () => {
    if (scModalPage > 1) {
      scModalPage--;
      renderScRecipientsModalPage();
    }
  });

  nextBtn?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(scModalRecipients.length / SC_RECIPIENTS_PER_PAGE));
    if (scModalPage < totalPages) {
      scModalPage++;
      renderScRecipientsModalPage();
    }
  });
}

async function openScRecipientsModal(rec) {
  const overlay = document.getElementById('scRecipientsModalOverlay');
  const modal = document.getElementById('scRecipientsModal');
  const tbody = document.getElementById('scRecipientsTableBody');
  const pageInfo = document.getElementById('scRecipientsPageInfo');
  const prevBtn = document.getElementById('scRecipientsPrevBtn');
  const nextBtn = document.getElementById('scRecipientsNextBtn');

  if (!overlay || !modal) return;

  setText('scRecipientsFileName', rec.file_name || '—');
  setText('scRecipientsUploadDate', rec.uploaded_at || '—');

  scModalRecipients = [];
  scModalPage = 1;

  if (tbody) {
    tbody.innerHTML =
      `<tr><td colspan="5" style="text-align:center;padding:24px;color:#6b7280;">
         Loading recipients...
       </td></tr>`;
  }
  if (pageInfo) pageInfo.textContent = 'Showing 0 of 0 records';
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;

  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  modal.focus();

  const batchId = Number(rec.upload_batch_id || 0);
  if (batchId <= 0) {
    renderScRecipientsEmpty('No recipient records found for this upload.');
    return;
  }

  try {
    const response = await fetch(
      `${SC_BATCH_RECIPIENTS_API}?upload_batch_id=${encodeURIComponent(batchId)}`,
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      }
    );

    const checked = await window.PERSYSApiErrors.handleResponse(response);
    if (!checked) return;

    const result = await checked.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to load recipients.');
    }

    const batch = result.data?.batch;
    if (batch) {
      setText('scRecipientsFileName', batch.file_name || rec.file_name || '—');
      setText('scRecipientsUploadDate', batch.uploaded_at || rec.uploaded_at || '—');
    }

    scModalRecipients = Array.isArray(result.data?.recipients)
      ? result.data.recipients
      : [];
    scModalPage = 1;
    renderScRecipientsModalPage();
  } catch (err) {
    console.error('Batch recipients load error:', err);
    renderScRecipientsEmpty(err.message || 'Unable to load service credit recipients.');
  }
}

function renderScRecipientsEmpty(message) {
  const tbody = document.getElementById('scRecipientsTableBody');
  const pageInfo = document.getElementById('scRecipientsPageInfo');
  const prevBtn = document.getElementById('scRecipientsPrevBtn');
  const nextBtn = document.getElementById('scRecipientsNextBtn');

  if (tbody) {
    tbody.replaceChildren();
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.style.cssText = 'text-align:center;padding:24px;color:#9ca3af;font-style:italic;';
    td.textContent = message;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
  if (pageInfo) pageInfo.textContent = 'Showing 0 of 0 records';
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;
}

function renderScRecipientsModalPage() {
  const tbody = document.getElementById('scRecipientsTableBody');
  const pageInfo = document.getElementById('scRecipientsPageInfo');
  const prevBtn = document.getElementById('scRecipientsPrevBtn');
  const nextBtn = document.getElementById('scRecipientsNextBtn');

  if (!tbody) return;

  const total = scModalRecipients.length;
  if (total === 0) {
    renderScRecipientsEmpty('No employees received service credits in this upload.');
    return;
  }

  const totalPages = Math.max(1, Math.ceil(total / SC_RECIPIENTS_PER_PAGE));
  scModalPage = Math.min(Math.max(1, scModalPage), totalPages);

  const startIdx = (scModalPage - 1) * SC_RECIPIENTS_PER_PAGE;
  const endIdx = Math.min(startIdx + SC_RECIPIENTS_PER_PAGE, total);
  const slice = scModalRecipients.slice(startIdx, endIdx);

  tbody.replaceChildren();

  slice.forEach(item => {
    const tr = document.createElement('tr');

    const tdId = document.createElement('td');
    tdId.textContent = item.employee_number || '—';

    const tdName = document.createElement('td');
    tdName.textContent = item.employee_name || '—';

    const tdRole = document.createElement('td');
    tdRole.textContent = item.current_role || '—';

    const tdCreditType = document.createElement('td');
    tdCreditType.textContent = item.credit_type || '—';

    const tdCredits = document.createElement('td');
    const creditsSpan = document.createElement('span');
    creditsSpan.className = 'sc-added-credits-val';
    const num = Number(item.credit_amount ?? 0);
    const formattedNum = Number.isFinite(num)
      ? num.toFixed(1)
      : '0.0';
    creditsSpan.textContent = `+${formattedNum} Credits`;
    tdCredits.appendChild(creditsSpan);

    tr.append(tdId, tdName, tdRole, tdCreditType, tdCredits);
    tbody.appendChild(tr);
  });

  if (pageInfo) {
    pageInfo.textContent = `Showing ${startIdx + 1}-${endIdx} of ${total} records`;
  }
  if (prevBtn) prevBtn.disabled = scModalPage <= 1;
  if (nextBtn) nextBtn.disabled = scModalPage >= totalPages;
}

function closeScRecipientsModal() {
  document.getElementById('scRecipientsModalOverlay')?.classList.remove('is-open');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════════════════════════
   FORM 6 & MODAL (Ad-blocker & Popup-blocker resilient Fetch + Blob PDF)
═══════════════════════════════════════════════════════════════ */

async function openForm6(r, triggerBtn = null) {
  const statusLow = String(r.status ?? '').toLowerCase();
  if (statusLow === 'rejected' || statusLow === 'disapproved') {
    alert('Form 6 is unavailable for disapproved requests.');
    return;
  }

  const originalHtml = triggerBtn ? triggerBtn.innerHTML : '';
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.textContent = 'Generating...';
  }

  try {
    const rid = r.leave_request_id;
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

function wireModal() {
  const overlay = document.getElementById('txModalOverlay');
  const closeBtn = document.getElementById('txModalClose');
  const modalCloseFooter = document.getElementById('txModalCloseFooter');
  const modalForm6Btn = document.getElementById('txModalForm6');

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (modalCloseFooter) modalCloseFooter.addEventListener('click', closeModal);
  overlay?.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay?.classList.contains('is-open')) closeModal();
  });

  if (modalForm6Btn) {
    modalForm6Btn.addEventListener('click', () => {
      const ridEl = document.getElementById('txModalRequestId');
      const r = leaveHistoryRecords.find(x => String(x.leave_request_id) === String(ridEl?.value));
      if (r) openForm6(r, modalForm6Btn);
    });
  }
}

function openModal(r) {
  const overlay = document.getElementById('txModalOverlay');
  const modal = document.getElementById('txModal');
  const rawStatusLow = String(r.status ?? 'approved').toLowerCase();
  const isApproved = rawStatusLow === 'approved';
  const modalStatusKey = isApproved ? 'approved' : 'rejected';
  const displayStatusText = isApproved ? 'Approved' : 'Disapproved';

  modal.dataset.status = modalStatusKey;

  const ridEl = document.getElementById('txModalRequestId');
  if (ridEl) ridEl.value = r.leave_request_id;

  setText('txRequestNumber', r.request_number);
  setText('txStatusText', displayStatusText);
  setText('txEmployeeName', buildName(r));
  setText('txEmployeeNumber', r.employee_number);
  setText('txPosition', r.position);
  setText('txLeaveType', r.leave_type_name);
  setText('txReason', r.reason_details || 'Not provided');
  setText('txStartDate', formatDateLong(r.start_datetime));
  setText('txEndDate', formatDateLong(r.end_datetime));
  setText('txTotalDays', `${r.total_leave_days} Days`);
  setText('txCreditType', r.credit_type_name ?? 'Not selected');

  const creditId = r.credit_type_id;
  if (creditId && isApproved) {
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

  setText('txReviewedBy', r.reviewer_name || '—');
  setText('txReviewedAt', r.reviewed_at ? formatDateLong(r.reviewed_at) : '—');

  const statusBadge = document.getElementById('txModalStatusBadge');
  if (statusBadge) {
    statusBadge.textContent = `Status: ${displayStatusText}`;
    statusBadge.className = `tx-modal-status-pill tx-status-${modalStatusKey}`;
  }

  const form6Btn = document.getElementById('txModalForm6');
  if (form6Btn) {
    form6Btn.style.display = isApproved ? 'inline-flex' : 'none';
  }

  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  modal.focus();
}

function closeModal() {
  document.getElementById('txModalOverlay')?.classList.remove('is-open');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════════════════════════
   PAGINATION
═══════════════════════════════════════════════════════════════ */

function renderPagination(page, totalPages, container) {
  if (!container) return;
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
