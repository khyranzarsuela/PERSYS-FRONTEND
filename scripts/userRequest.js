/* ============================================================
   PERSYS — User Request Page
   Handles leave request form, review, submission, and table.
   No jQuery — pure vanilla JS fetch().
   ============================================================ */

const REQUEST_API =
  `${window.PERSYS_CONFIG.API_BASE_URL}/api/user/request.php`;

// ── Pending submit data passed between modals ────────────────
let _pendingSubmit = {};
let allMyRequests = [];
let filteredMyRequests = [];
let myReqCurrentPage = 1;
const MY_REQ_PER_PAGE = 5;

document.addEventListener('DOMContentLoaded', async () => {
  const authorized = await window.PERSYSUserGuard.ready;
  if (!authorized) return;

  wireTableFilters();
  await loadRequestPage();
  wireModals();
});

function wireTableFilters() {
  const searchInput = document.getElementById('uLrSearchInput');
  const statusSelect = document.getElementById('uLrStatusFilter');

  searchInput?.addEventListener('input', applyMyRequestFilters);
  statusSelect?.addEventListener('change', applyMyRequestFilters);
}

/* ── Main loader ────────────────────────────────────────────── */

async function loadRequestPage() {
  const tbody = document.getElementById('requestTableBody');

  try {
    let response;

    try {
      response = await fetch(REQUEST_API, {
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
    if (!result.success) throw new Error(result.message || 'Unable to load request data.');

    const { user, leave_types, requests } = result.data;

    // ── Sidebar ────────────────────────────────────────────
    document.getElementById('userUsername').textContent = user.username;
    document.getElementById('userRole').textContent     = user.role_name;

    // ── Populate leave type dropdown ───────────────────────
    const select = document.getElementById('leaveTypeSelect');
    select.innerHTML = '<option value="">Select Leave Type</option>';

    leave_types.forEach(lt => {
      const opt = document.createElement('option');
      opt.value       = lt.leave_type_id;
      opt.textContent = lt.leave_type_name;
      select.appendChild(opt);
    });

    // ── Store requests, update 3 stat cards, and render table ──
    allMyRequests = Array.isArray(requests) ? requests : [];
    updateLeaveCountCards(allMyRequests);
    applyMyRequestFilters();

  } catch (error) {
    console.error('Request page load error:', error);
    if (tbody) {
      tbody.innerHTML =
        `<tr class="empty-row">
           <td colspan="6" style="text-align:center;padding:24px;color:#9ca3af;">Unable to load requests. Please refresh.</td>
         </tr>`;
    }
  }
}

function updateLeaveCountCards(requests) {
  let pending = 0;
  let approved = 0;
  let disapproved = 0;

  (requests || []).forEach(r => {
    const st = String(r.status || '').toLowerCase();
    if (st === 'pending') pending++;
    else if (st === 'approved') approved++;
    else if (st === 'rejected' || st === 'disapproved') disapproved++;
  });

  const setTxt = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setTxt('uLrPendingCount', String(pending));
  setTxt('uLrPendingSub', pending > 0 ? `${pending} pending` : 'No pending requests');

  setTxt('uLrApprovedCount', String(approved));
  setTxt('uLrApprovedSub', approved > 0 ? `${approved} approved` : 'No approved requests');

  setTxt('uLrDisapprovedCount', String(disapproved));
  setTxt('uLrDisapprovedSub', disapproved > 0 ? `${disapproved} disapproved` : 'No disapproved requests');
}

function applyMyRequestFilters() {
  const q = (document.getElementById('uLrSearchInput')?.value ?? '').trim().toLowerCase();
  const statusVal = (document.getElementById('uLrStatusFilter')?.value ?? 'all').toLowerCase();

  filteredMyRequests = allMyRequests.filter(r => {
    const rawSt = String(r.status || '').toLowerCase();
    const dispSt = rawSt === 'rejected' ? 'disapproved' : rawSt;
    const reqNo = String(r.request_number || '').toLowerCase();
    const lType = String(r.leave_type_name || '').toLowerCase();
    const filed = formatSlashDate(r.date_filed).toLowerCase();

    if (statusVal !== 'all' && dispSt !== statusVal) return false;
    if (q && !reqNo.includes(q) && !lType.includes(q) && !dispSt.includes(q) && !filed.includes(q)) {
      return false;
    }
    return true;
  });

  myReqCurrentPage = 1;
  renderRequestsTable();
}

function formatSlashDate(val) {
  if (!val) return '—';
  const ymd = String(val).trim().slice(0, 10);
  const parts = ymd.split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}/${parts[0]}`;
  }
  return formatDate(val);
}

/* ── Table renderer ─────────────────────────────────────────── */

function renderRequestsTable() {
  const tbody = document.getElementById('requestTableBody');
  const pagEl = document.getElementById('uLrPagination');
  if (!tbody) return;
  tbody.replaceChildren();

  const total = filteredMyRequests.length;
  const totalPages = Math.max(1, Math.ceil(total / MY_REQ_PER_PAGE));
  myReqCurrentPage = Math.min(Math.max(1, myReqCurrentPage), totalPages);

  if (total === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    const td = document.createElement('td');
    td.colSpan = 6;
    td.style.cssText = 'text-align:center;padding:28px;color:#9ca3af;font-style:italic;';
    td.textContent = allMyRequests.length > 0
      ? 'No requests match your search or filter.'
      : 'No leave requests found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    if (pagEl) pagEl.hidden = true;
    return;
  }

  const start = (myReqCurrentPage - 1) * MY_REQ_PER_PAGE;
  const slice = filteredMyRequests.slice(start, start + MY_REQ_PER_PAGE);

  slice.forEach(r => {
    const tr = document.createElement('tr');

    // Store row data for the detail modal
    tr.dataset.reqNumber = r.request_number;
    tr.dataset.leaveType = r.leave_type_name;
    tr.dataset.start     = r.start_datetime ? r.start_datetime.slice(0, 10) : '';
    tr.dataset.end       = r.end_datetime   ? r.end_datetime.slice(0, 10)   : '';
    tr.dataset.days      = r.total_leave_days;
    tr.dataset.status    = r.status;

    // 1. Request No.
    const tdNum = document.createElement('td');
    tdNum.textContent = r.request_number || '—';

    // 2. Date Filed (MM/DD/YYYY)
    const tdFiled = document.createElement('td');
    tdFiled.textContent = formatSlashDate(r.date_filed);

    // 3. Leave Type
    const tdType = document.createElement('td');
    tdType.textContent = r.leave_type_name || '—';

    // 4. Leave Dates (MM/DD/YYYY - MM/DD/YYYY)
    const tdDates = document.createElement('td');
    const startFmt = formatSlashDate(r.start_datetime);
    const endFmt   = formatSlashDate(r.end_datetime);
    tdDates.textContent = startFmt === endFmt ? startFmt : `${startFmt} - ${endFmt}`;

    // 5. Total Days (2 decimals, e.g. 15.00)
    const tdDays = document.createElement('td');
    tdDays.textContent = Number(r.total_leave_days ?? 0).toFixed(2);

    // 6. Status badge pill with dot
    const tdStatus = document.createElement('td');
    const rawSt = String(r.status || 'Pending').toLowerCase();
    const isApproved = rawSt === 'approved';
    const isPending = rawSt === 'pending';
    const pillClass = isPending ? 'is-pending' : (isApproved ? 'is-approved' : 'is-disapproved');
    const pillLabel = isPending ? 'Pending' : (isApproved ? 'Approved' : 'Disapproved');

    const pill = document.createElement('span');
    pill.className = `u-lr-status-pill ${pillClass}`;
    const dot = document.createElement('span');
    dot.className = 'u-lr-status-dot';
    dot.setAttribute('aria-hidden', 'true');
    pill.append(dot, document.createTextNode(pillLabel));
    tdStatus.appendChild(pill);

    tr.append(tdNum, tdFiled, tdType, tdDates, tdDays, tdStatus);
    tbody.appendChild(tr);
  });

  if (pagEl) {
    pagEl.hidden = false;
    pagEl.replaceChildren();

    const info = document.createElement('span');
    info.className = 'u-lr-pag-info';
    info.textContent = `Showing ${start + 1}–${Math.min(start + MY_REQ_PER_PAGE, total)} of ${total} record${total === 1 ? '' : 's'}`;

    const btns = document.createElement('div');
    btns.className = 'u-lr-pag-btns';
    for (let i = 1; i <= totalPages; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'u-lr-page-btn' + (i === myReqCurrentPage ? ' is-active' : '');
      b.textContent = String(i);
      b.addEventListener('click', () => {
        myReqCurrentPage = i;
        renderRequestsTable();
      });
      btns.appendChild(b);
    }

    pagEl.append(info, btns);
  }
}

/* ── Modal wiring ───────────────────────────────────────────── */

function wireModals() {
  const $ = id => document.getElementById(id);

  // ── Helpers ──────────────────────────────────────────────
  function showModal(id)  { $(id).style.display = 'flex'; }
  function hideModal(id)  { $(id).style.display = 'none'; }

  // Close any modal when clicking the backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  });

  // ── Open leave form ───────────────────────────────────────
  $('openLeaveFormBtn').addEventListener('click', () => {
    // Reset form fields
    $('leaveTypeSelect').value = '';
    $('leaveStartDate').value  = '';
    $('leaveEndDate').value    = '';
    $('totalLeaveDays').value  = '1';
    $('leaveReason').value     = '';
    clearFormErrors();
    updateReasonRequirement('');  // reset hint to optional
    showModal('leaveFormModal');
  });

  // ── Close (X) & Cancel leave form ─────────────────────────
  $('closeLeaveFormBtn')?.addEventListener('click', () => hideModal('leaveFormModal'));
  $('cancelLeaveFormBtn').addEventListener('click', () => hideModal('leaveFormModal'));

  // ── Leave type change → update reason requirement hint ────
  $('leaveTypeSelect').addEventListener('change', () => {
    const selectedText = $('leaveTypeSelect').selectedOptions[0]?.text ?? '';
    updateReasonRequirement(selectedText);
    // Clear any existing reason error when type changes
    const reasonField = $('leaveReason');
    if (reasonField) {
      reasonField.classList.remove('field-input-error');
      const errEl = reasonField.parentElement.querySelector('.field-error-msg');
      if (errEl) errEl.remove();
    }
  });

  // ── Date inputs → recalculate weekdays ────────────────────
  ['leaveStartDate', 'leaveEndDate'].forEach(id => {
    $(id).addEventListener('change', () => {
      const s = $('leaveStartDate').value;
      const e = $('leaveEndDate').value;
      $('totalLeaveDays').value = (s && e) ? countWeekdays(s, e) : '1';
    });
  });

  // ── Submit Application (validates and submits directly) ───
  $('reviewLeaveBtn').addEventListener('click', async () => {
    clearFormErrors();

    const leaveTypeId   = $('leaveTypeSelect').value;
    const leaveTypeName = $('leaveTypeSelect').selectedOptions[0]?.text ?? '';
    const startDate     = $('leaveStartDate').value;
    const endDate       = $('leaveEndDate').value;
    const totalDays     = (startDate && endDate)
      ? countWeekdays(startDate, endDate)
      : parseInt($('totalLeaveDays').value, 10);
    const reason        = $('leaveReason').value.trim();

    if (startDate && endDate) {
      $('totalLeaveDays').value = String(totalDays);
    }

    let valid = true;

    if (!leaveTypeId) {
      showFieldError('leaveTypeSelect', 'Please select a leave type.');
      valid = false;
    }
    if (!startDate) {
      showFieldError('leaveStartDate', 'Start date is required.');
      valid = false;
    }
    if (!endDate) {
      showFieldError('leaveEndDate', 'End date is required.');
      valid = false;
    }
    if (startDate && endDate && endDate < startDate) {
      showFieldError('leaveEndDate', 'End date cannot be before start date.');
      valid = false;
    }
    if (!totalDays || totalDays <= 0) {
      showFieldError('totalLeaveDays', 'Must have at least 1 weekday.');
      valid = false;
    }

    // Reason is required only when leave type is "Others"
    const isOthers = leaveTypeName.trim().toLowerCase() === 'others';
    if (isOthers && !reason) {
      showFieldError('leaveReason', 'Please provide a reason for "Others" leave type.');
      valid = false;
    }

    // Wellness cap — when leave type is "Others" and reason contains
    // the word "wellness" (case-insensitive), max 3 days allowed.
    if (isOthers && reason && /wellness/i.test(reason) && totalDays > 3) {
      showFieldError('leaveReason',
        'Wellness leave is limited to a maximum of 3 days. ' +
        `You entered ${totalDays} day(s).`
      );
      showFieldError('totalLeaveDays',
        'Maximum 3 days allowed for Wellness leave.'
      );
      valid = false;
    }

    if (!valid) return;

    _pendingSubmit = { leaveTypeId, leaveTypeName, startDate, endDate, totalDays, reason };

    const btn = $('reviewLeaveBtn');
    btn.disabled    = true;
    btn.textContent = 'Submitting...';

    try {
      let response;
      try {
        response = await fetch(REQUEST_API, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            leave_type_id:    _pendingSubmit.leaveTypeId,
            start_date:       _pendingSubmit.startDate,
            end_date:         _pendingSubmit.endDate,
            total_leave_days: _pendingSubmit.totalDays,
            reason_details:   _pendingSubmit.reason,
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
        throw new Error(result.message || 'Could not submit request.');
      }

      $('sentRequestNumber').textContent = result.request_number;
      hideModal('leaveFormModal');
      showModal('requestSentModal');

      refreshTable();
    } catch (error) {
      console.error('Submit leave error:', error);
      hideModal('leaveFormModal');
      showSubmitError(error.message || 'An error occurred. Please try again.');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Submit Application';
    }
  });

  // ── Back to edit ──────────────────────────────────────────
  $('backToEditBtn').addEventListener('click', () => {
    hideModal('reviewLeaveModal');
    showModal('leaveFormModal');
  });

  // ── Submit leave request ──────────────────────────────────
  $('submitLeaveBtn').addEventListener('click', async () => {
    const btn = $('submitLeaveBtn');
    btn.disabled    = true;
    btn.textContent = 'Sending…';

    try {
      let response;

      try {
        response = await fetch(REQUEST_API, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            leave_type_id:    _pendingSubmit.leaveTypeId,
            start_date:       _pendingSubmit.startDate,
            end_date:         _pendingSubmit.endDate,
            total_leave_days: _pendingSubmit.totalDays,
            reason_details:   _pendingSubmit.reason,
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
        throw new Error(result.message || 'Could not submit request.');
      }

      // Show success modal
      $('sentRequestNumber').textContent = result.request_number;
      hideModal('reviewLeaveModal');
      showModal('requestSentModal');

      // Silently refresh the table in the background
      refreshTable();

    } catch (error) {
      console.error('Submit leave error:', error);
      hideModal('reviewLeaveModal');
      showSubmitError(error.message || 'An error occurred. Please try again.');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Request and Send';
    }
  });

  // ── View Request after send ───────────────────────────────
  $('viewRequestAfterSend').addEventListener('click', () => {
    hideModal('requestSentModal');
  });

  // ── View details from table (clicking any row) ────────────
  document.getElementById('requestTableBody')
    .addEventListener('click', e => {
      const tr = e.target.closest('tr[data-req-number]');
      if (!tr) return;

      const status = tr.dataset.status;
      const noteMap = {
        Pending:  'Waiting for administrator approval.',
        Approved: 'Your leave has been approved.',
        Rejected: 'Your leave request was disapproved.',
      };

      $('detailRequestNumber').textContent = tr.dataset.reqNumber;
      $('detailLeaveType').textContent     = tr.dataset.leaveType;
      $('detailStartDate').textContent     = formatDate(tr.dataset.start);
      $('detailEndDate').textContent       = formatDate(tr.dataset.end);
      $('detailTotalDays').textContent     = tr.dataset.days;
      $('detailStatus').textContent        = status === 'Rejected' ? 'Disapproved' : status;
      $('detailStatusNote').textContent    = noteMap[status] ?? '';

      showModal('requestDetailsModal');
    });

  // ── Close details modal ───────────────────────────────────
  $('closeDetailsBtn').addEventListener('click', () => hideModal('requestDetailsModal'));

  // ── Submit error modal close ──────────────────────────────
  const closeErrBtn = $('closeSubmitErrorBtn');
  if (closeErrBtn) {
    closeErrBtn.addEventListener('click', () => hideModal('submitErrorModal'));
  }
}

/* ── Reason requirement toggle ──────────────────────────────── */

/**
 * Shows "(optional)" or "*required" next to the Reason label
 * depending on whether "Others" is selected.
 */
function updateReasonRequirement(leaveTypeName) {
  const isOthers    = leaveTypeName.trim().toLowerCase() === 'others';
  const requiredEl  = document.getElementById('leaveReasonRequiredBadge');
  const optionalEl  = document.getElementById('leaveReasonOptionalHint');
  const textarea    = document.getElementById('leaveReason');

  if (requiredEl) requiredEl.style.display = isOthers ? 'inline' : 'none';
  if (optionalEl) optionalEl.style.display = isOthers ? 'none'   : 'inline';
  if (textarea)   textarea.placeholder     = isOthers
    ? 'Required — provide additional details for your leave request...'
    : 'Provide additional details for your leave request...';
}

/* ── Silently refresh the table after a successful submit ───── */

async function refreshTable() {
  try {
    const response = await fetch(REQUEST_API, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) return;

    const result = await response.json();
    if (!result.success) return;

    allMyRequests = Array.isArray(result.data.requests) ? result.data.requests : [];
    updateLeaveCountCards(allMyRequests);
    applyMyRequestFilters();
  } catch {
    // Silent failure — table will refresh on next page load
  }
}

/* ── Inline form field error helpers ────────────────────────── */

function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  field.classList.add('field-input-error');

  let errEl = field.parentElement.querySelector('.field-error-msg');
  if (!errEl) {
    errEl = document.createElement('span');
    errEl.className = 'field-error-msg';
    field.after(errEl);
  }

  errEl.textContent = message;
}

function clearFormErrors() {
  document.querySelectorAll('.field-input-error').forEach(el => {
    el.classList.remove('field-input-error');
  });
  document.querySelectorAll('.field-error-msg').forEach(el => el.remove());
}

/* ── Show inline submit error ───────────────────────────────── */

function showSubmitError(message) {
  const modal = document.getElementById('submitErrorModal');
  const msg   = document.getElementById('submitErrorMessage');

  if (modal && msg) {
    msg.textContent      = message;
    modal.style.display  = 'flex';
  } else {
    alert(message);
  }
}

/* ── Formatting helpers ─────────────────────────────────────── */

function countWeekdays(startStr, endStr) {
  const parseLocal = str => {
    const parts = String(str || '').trim().slice(0, 10).split('-');
    if (parts.length !== 3) return new Date(NaN);
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  };
  const start = parseLocal(startStr);
  const end   = parseLocal(endStr);
  if (isNaN(start) || isNaN(end) || end < start) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric'
  });
}
