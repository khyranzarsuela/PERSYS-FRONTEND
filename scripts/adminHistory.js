/* ============================================================
   PERSYS — Admin Service Credit Upload & Leave Request History
   Displays two stacked full-width cards:
   1. Service Credit Upload (per-transaction EARNED records + View details modal)
   2. Leave Request History (Approved & Disapproved leave requests + View + Form 6)
   ============================================================ */

const TX_API = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/transactions.php`;
const SC_SUMMARY_API = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/serviceCredits/summary.php`;
const FORM6_BASE = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/generateForm6.php`;

// ── Service Credit Upload History state ──────────────────────────
let scUploadRecords = [];
let scFilteredRows = [];
let scCurrentPage = 1;
let scRowsPerPage = 5;

// ── Leave Request History state ──────────────────────────────────
let leaveHistoryRecords = [];
let leaveFilteredRows = [];
let leaveCurrentPage = 1;
let leaveRowsPerPage = 5;

document.addEventListener('DOMContentLoaded', async () => {
  const authorized = await window.PERSYSAdminGuard.ready;
  if (!authorized) return;

  wireScFilters();
  wireLeaveFilters();
  wireScDetailModal();
  wireLeaveDetailModal();

  await Promise.all([
    loadServiceCreditHistory(),
    loadLeaveHistory()
  ]);

  applyScFilters();
  applyLeaveFilters();
});

/* ═══════════════════════════════════════════════════════════════
   DATA LOADING
═══════════════════════════════════════════════════════════════ */

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
    if (!result.success) throw new Error(result.message || 'Unable to load service credit upload history.');

    const data = result.data || {};

    if (data.admin) {
      const usernameEl = document.getElementById('adminUsername');
      const roleEl = document.getElementById('adminRole');
      if (usernameEl) usernameEl.textContent = data.admin.username;
      if (roleEl) roleEl.textContent = data.admin.role_name;
    }

    const records = Array.isArray(data.upload_transactions_history)
      ? [...data.upload_transactions_history]
      : [];

    records.sort((a, b) => {
      const timeA = parseTimestamp(a.uploaded_at);
      const timeB = parseTimestamp(b.uploaded_at);
      if (timeB !== timeA) return timeB - timeA;
      return Number(b.transaction_id || 0) - Number(a.transaction_id || 0);
    });

    scUploadRecords = records;
  } catch (err) {
    console.error('Service credit upload history load error:', err);
    scUploadRecords = [];
  }
}

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

function parseTimestamp(val) {
  if (!val) return 0;
  const d = new Date(String(val).replace(' ', 'T'));
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/* ═══════════════════════════════════════════════════════════════
   CARD 1: SERVICE CREDIT UPLOAD FILTERS & TABLE
═══════════════════════════════════════════════════════════════ */

function wireScFilters() {
  const searchEl = document.getElementById('scSearchInput');
  const roleEl = document.getElementById('scRoleFilter');
  const creditEl = document.getElementById('scCreditTypeFilter');
  const dateEl = document.getElementById('scDateFilter');

  searchEl?.addEventListener('input', applyScFilters);
  roleEl?.addEventListener('change', applyScFilters);
  creditEl?.addEventListener('change', applyScFilters);
  dateEl?.addEventListener('change', applyScFilters);
  dateEl?.addEventListener('input', applyScFilters);
}

function applyScFilters() {
  const term = (document.getElementById('scSearchInput')?.value ?? '').trim().toLowerCase();
  const roleFilter = document.getElementById('scRoleFilter')?.value ?? 'all';
  const creditFilter = document.getElementById('scCreditTypeFilter')?.value ?? 'all';
  const dateFilter = (document.getElementById('scDateFilter')?.value ?? '').trim();

  scFilteredRows = scUploadRecords.filter(rec => {
    const empName = String(rec.employee_name ?? '').toLowerCase();
    const empNum = String(rec.employee_number ?? '').toLowerCase();
    const uploadedBy = String(rec.uploaded_by_name ?? '').toLowerCase();
    const activity = String(rec.activity_name ?? '').toLowerCase();
    const fileName = String(rec.file_name ?? '').toLowerCase();
    const role = String(rec.role ?? '');
    const creditType = String(rec.credit_type ?? '');
    const uploadedDateYMD = String(rec.uploaded_at ?? '').slice(0, 10);

    const matchSearch = !term ||
      [empName, empNum, uploadedBy, activity, fileName, role.toLowerCase(), creditType.toLowerCase()]
        .some(v => v.includes(term));

    const matchRole = roleFilter === 'all' || role.toLowerCase() === roleFilter.toLowerCase();
    const matchCredit = creditFilter === 'all' || creditType.toLowerCase() === creditFilter.toLowerCase();
    const matchDate = !dateFilter || uploadedDateYMD === dateFilter;

    return matchSearch && matchRole && matchCredit && matchDate;
  });

  scCurrentPage = 1;
  renderScPage();
}

function renderScPage() {
  const tbody = document.getElementById('scHistoryTableBody');
  const pagination = document.getElementById('scHistoryPagination');
  if (!tbody) return;

  const total = scFilteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / scRowsPerPage));
  scCurrentPage = Math.min(Math.max(1, scCurrentPage), totalPages);

  tbody.replaceChildren();

  if (total === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.style.cssText = 'text-align:center;padding:32px;color:#9ca3af;font-style:italic;';
    td.textContent = scUploadRecords.length > 0
      ? 'No service credit upload records match the current filter.'
      : 'No service credit upload records found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    if (pagination) pagination.hidden = true;
    return;
  }

  const start = (scCurrentPage - 1) * scRowsPerPage;
  const pageItems = scFilteredRows.slice(start, start + scRowsPerPage);

  pageItems.forEach(rec => tbody.appendChild(buildScRow(rec)));

  renderTablePagination({
    page: scCurrentPage,
    totalPages,
    total,
    rowsPerPage: scRowsPerPage,
    container: pagination,
    onPageChange: newPage => {
      scCurrentPage = newPage;
      renderScPage();
    },
    onRowsPerPageChange: newSize => {
      scRowsPerPage = newSize;
      scCurrentPage = 1;
      renderScPage();
    }
  });
}

function buildScRow(rec) {
  const tr = document.createElement('tr');

  // Col 1: Date Uploaded
  const tdDate = document.createElement('td');
  tdDate.textContent = formatDate(rec.uploaded_at);

  // Col 2: Uploaded By
  const tdUploadedBy = document.createElement('td');
  tdUploadedBy.textContent = rec.uploaded_by_name || '—';

  // Col 3: Name
  const tdName = document.createElement('td');
  tdName.textContent = rec.employee_name || '—';

  // Col 4: Role (Full: Teaching | Non-Teaching)
  const tdRole = document.createElement('td');
  tdRole.textContent = rec.role || '—';

  // Col 5: Credit Type (Full: Local | National | Wellness)
  const tdCreditType = document.createElement('td');
  tdCreditType.textContent = rec.credit_type || '—';

  // Col 6: Added Credits
  const tdAdded = document.createElement('td');
  const num = Number(rec.credit_amount ?? 0);
  tdAdded.textContent = Number.isFinite(num) ? num.toFixed(2) : '0.00';

  // Col 7: Details (Green pill View button)
  const tdDetails = document.createElement('td');
  const viewBtn = document.createElement('button');
  viewBtn.type = 'button';
  viewBtn.className = 'sc-view-pill-btn';
  viewBtn.textContent = 'View';
  viewBtn.addEventListener('click', () => openScDetailModal(rec));
  tdDetails.appendChild(viewBtn);

  tr.append(tdDate, tdUploadedBy, tdName, tdRole, tdCreditType, tdAdded, tdDetails);
  return tr;
}

/* ═══════════════════════════════════════════════════════════════
   SERVICE CREDIT UPLOAD DETAILS MODAL
═══════════════════════════════════════════════════════════════ */

function wireScDetailModal() {
  const overlay = document.getElementById('scUploadDetailModalOverlay');
  const closeBtn = document.getElementById('scUploadDetailCloseBtn');
  const footerCloseBtn = document.getElementById('scUploadDetailFooterCloseBtn');

  closeBtn?.addEventListener('click', closeScDetailModal);
  footerCloseBtn?.addEventListener('click', closeScDetailModal);
  overlay?.addEventListener('click', e => {
    if (e.target === overlay) closeScDetailModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay?.classList.contains('is-open')) {
      closeScDetailModal();
    }
  });
}

function openScDetailModal(rec) {
  const overlay = document.getElementById('scUploadDetailModalOverlay');
  const modal = document.getElementById('scUploadDetailModal');
  if (!overlay || !modal) return;

  const isManual = String(rec.upload_type || '').toLowerCase().includes('manual') ||
                   String(rec.file_name || '').toLowerCase() === 'n/a' ||
                   String(rec.file_name || '').toLowerCase() === 'manual upload';

  const uploadType = isManual ? 'Manual Upload' : 'Excel Upload';
  const fileName = isManual ? 'N/A' : (rec.file_name || 'N/A');

  const startFmt = rec.activity_start_date ? formatDate(rec.activity_start_date) : '';
  const endFmt = rec.activity_end_date ? formatDate(rec.activity_end_date) : '';
  let activityDates = '—';
  if (startFmt && endFmt) {
    activityDates = startFmt === endFmt ? startFmt : `${startFmt} – ${endFmt}`;
  } else if (startFmt || endFmt) {
    activityDates = startFmt || endFmt;
  }

  const amt = Number(rec.credit_amount ?? 0);
  const formattedAmt = Number.isFinite(amt) ? `+${amt.toFixed(2)} Credits` : '0.00';

  setText('scDetailUploadType', uploadType);
  setText('scDetailFileName', fileName);
  setText('scDetailDateUploaded', formatDateLong(rec.uploaded_at));
  setText('scDetailUploadedBy', rec.uploaded_by_name || '—');
  setText('scDetailEmployeeNumber', rec.employee_number || '—');
  setText('scDetailEmployeeName', rec.employee_name || '—');
  setText('scDetailRole', rec.role || '—');
  setText('scDetailActivityName', rec.activity_name || '—');
  setText('scDetailActivityDates', activityDates);
  setText('scDetailCreditType', rec.credit_type || '—');
  setText('scDetailAddedCredits', formattedAmt);

  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  modal.focus();
}

function closeScDetailModal() {
  document.getElementById('scUploadDetailModalOverlay')?.classList.remove('is-open');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════════════════════════
   CARD 2: LEAVE REQUEST HISTORY FILTERS & TABLE
═══════════════════════════════════════════════════════════════ */

function wireLeaveFilters() {
  const searchEl = document.getElementById('leaveHistorySearchInput');
  const typeEl = document.getElementById('leaveTypeFilter');
  const statusEl = document.getElementById('leaveStatusFilter');

  searchEl?.addEventListener('input', applyLeaveFilters);
  typeEl?.addEventListener('change', applyLeaveFilters);
  statusEl?.addEventListener('change', applyLeaveFilters);
}

function applyLeaveFilters() {
  const term = (document.getElementById('leaveHistorySearchInput')?.value ?? '').trim().toLowerCase();
  const typeFilter = (document.getElementById('leaveTypeFilter')?.value ?? 'all').toLowerCase();
  const statusFilter = (document.getElementById('leaveStatusFilter')?.value ?? 'all').toLowerCase();

  leaveFilteredRows = leaveHistoryRecords.filter(r => {
    const name = buildName(r).toLowerCase();
    const reviewer = String(r.reviewer_name ?? '').toLowerCase();
    const leaveType = String(r.leave_type_name ?? '').toLowerCase();
    const rawStatus = String(r.status ?? '').toLowerCase();
    const displayStatus = rawStatus === 'rejected' ? 'disapproved' : rawStatus;
    const credit = String(r.credit_type_name ?? 'not deducted').toLowerCase();
    const reqNum = String(r.request_number ?? '').toLowerCase();

    const matchSearch = !term ||
      [reqNum, reviewer, name, leaveType, displayStatus, rawStatus, credit].some(v => v.includes(term));

    const matchStatus = statusFilter === 'all' || displayStatus === statusFilter;
    const matchType = typeFilter === 'all' || credit.includes(typeFilter);

    return matchSearch && matchStatus && matchType;
  });

  leaveCurrentPage = 1;
  renderLeavePage();
}

function renderLeavePage() {
  const tbody = document.getElementById('leaveHistoryTableBody');
  const pagination = document.getElementById('leaveHistoryPagination');
  if (!tbody) return;

  const total = leaveFilteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / leaveRowsPerPage));
  leaveCurrentPage = Math.min(Math.max(1, leaveCurrentPage), totalPages);

  tbody.replaceChildren();

  if (total === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.style.cssText = 'text-align:center;padding:32px;color:#9ca3af;font-style:italic;';
    td.textContent = leaveHistoryRecords.length > 0
      ? 'No leave request history matches the current filter.'
      : 'No approved or disapproved leave requests found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    if (pagination) pagination.hidden = true;
    return;
  }

  const start = (leaveCurrentPage - 1) * leaveRowsPerPage;
  const pageItems = leaveFilteredRows.slice(start, start + leaveRowsPerPage);

  pageItems.forEach(r => tbody.appendChild(buildLeaveHistoryRow(r)));

  renderTablePagination({
    page: leaveCurrentPage,
    totalPages,
    total,
    rowsPerPage: leaveRowsPerPage,
    container: pagination,
    onPageChange: newPage => {
      leaveCurrentPage = newPage;
      renderLeavePage();
    },
    onRowsPerPageChange: newSize => {
      leaveRowsPerPage = newSize;
      leaveCurrentPage = 1;
      renderLeavePage();
    }
  });
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

  // Col 1: Request ID
  const tdReqId = document.createElement('td');
  tdReqId.textContent = r.request_number || rid || '—';

  // Col 2: Reviewed By
  const tdReviewedBy = document.createElement('td');
  tdReviewedBy.textContent = (r.reviewer_name && String(r.reviewer_name).trim()) || '—';

  // Col 3: Name
  const tdEmp = document.createElement('td');
  const empName = document.createElement('div');
  empName.className = 'tx-emp-name';
  empName.textContent = buildName(r);
  tdEmp.appendChild(empName);

  // Col 4: Leave Details
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

  // Col 5: Deduct From
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

  // Col 6: Status
  const tdStatus = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = `tx-status-badge tx-status-${badgeStatusClass}`;

  const dot = document.createElement('span');
  dot.className = 'tx-status-dot-inline';
  dot.setAttribute('aria-hidden', 'true');
  badge.appendChild(dot);
  badge.appendChild(document.createTextNode(displayStatusText));
  tdStatus.appendChild(badge);

  // Col 7: Actions (View + Form 6)
  const tdActions = document.createElement('td');
  tdActions.className = 'tx-actions-cell';

  const viewBtn = document.createElement('button');
  viewBtn.type = 'button';
  viewBtn.className = 'tx-inline-view';
  viewBtn.textContent = 'View';
  viewBtn.addEventListener('click', () => openLeaveModal(r));

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

  tr.append(tdReqId, tdReviewedBy, tdEmp, tdLeave, tdDeduct, tdStatus, tdActions);
  return tr;
}

/* ═══════════════════════════════════════════════════════════════
   FORM 6 & LEAVE REQUEST MODAL
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

    const newWin = window.open(blobUrl, '_blank');

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

function wireLeaveDetailModal() {
  const overlay = document.getElementById('txModalOverlay');
  const closeBtn = document.getElementById('txModalClose');
  const modalCloseFooter = document.getElementById('txModalCloseFooter');
  const modalForm6Btn = document.getElementById('txModalForm6');

  closeBtn?.addEventListener('click', closeLeaveModal);
  modalCloseFooter?.addEventListener('click', closeLeaveModal);
  overlay?.addEventListener('click', e => { if (e.target === overlay) closeLeaveModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay?.classList.contains('is-open')) closeLeaveModal();
  });

  modalForm6Btn?.addEventListener('click', () => {
    const ridEl = document.getElementById('txModalRequestId');
    const r = leaveHistoryRecords.find(x => String(x.leave_request_id) === String(ridEl?.value));
    if (r) openForm6(r, modalForm6Btn);
  });
}

function openLeaveModal(r) {
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

function closeLeaveModal() {
  document.getElementById('txModalOverlay')?.classList.remove('is-open');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════════════════════════
   SHARED EMPLOYEES-STYLE PAGINATION
═══════════════════════════════════════════════════════════════ */

function renderTablePagination({
  page,
  totalPages,
  total,
  rowsPerPage,
  container,
  onPageChange,
  onRowsPerPageChange
}) {
  if (!container) return;
  container.replaceChildren();

  if (total === 0) {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  const start = (page - 1) * rowsPerPage + 1;
  const end = Math.min(page * rowsPerPage, total);

  const info = document.createElement('div');
  info.className = 'pagination-info';
  info.textContent = `Showing ${start}-${end} of ${total} records`;

  const controls = document.createElement('div');
  controls.className = 'pagination-controls';

  const sizeLabel = document.createElement('label');
  sizeLabel.textContent = 'Rows per page: ';
  const sizeSelect = document.createElement('select');
  sizeSelect.className = 'pagination-select';
  sizeSelect.setAttribute('aria-label', 'Rows per page');
  [5, 10, 20].forEach(n => {
    const opt = document.createElement('option');
    opt.value = String(n);
    opt.textContent = String(n);
    if (n === rowsPerPage) opt.selected = true;
    sizeSelect.appendChild(opt);
  });
  sizeSelect.addEventListener('change', () => {
    onRowsPerPageChange(Number(sizeSelect.value) || 5);
  });
  sizeLabel.appendChild(sizeSelect);
  controls.appendChild(sizeLabel);

  controls.appendChild(
    makePagBtn('‹', page <= 1, () => onPageChange(page - 1))
  );

  for (const p of buildPageRange(page, totalPages)) {
    if (p === '…') {
      const span = document.createElement('span');
      span.style.padding = '0 4px';
      span.style.color = '#6B5E50';
      span.textContent = '…';
      controls.appendChild(span);
    } else {
      controls.appendChild(
        makePagBtn(String(p), false, () => onPageChange(p), p === page)
      );
    }
  }

  controls.appendChild(
    makePagBtn('›', page >= totalPages, () => onPageChange(page + 1))
  );

  container.append(info, controls);
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
  btn.className = 'pagination-button' + (isActive ? ' is-active' : '');
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
