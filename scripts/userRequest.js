/* ============================================================
   PERSYS — User Request Page
   Handles leave request form, review, submission, and table.
   No jQuery — pure vanilla JS fetch().
   ============================================================ */

const REQUEST_API =
  `${window.PERSYS_CONFIG.API_BASE_URL}/api/user/request.php`;

// ── Pending submit data passed between modals ────────────────
let _pendingSubmit = {};

document.addEventListener('DOMContentLoaded', async () => {
  const authorized = await window.PERSYSUserGuard.ready;
  if (!authorized) return;

  await loadRequestPage();
  wireModals();
});

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
    select.innerHTML = '<option value="">-- Select Leave Type --</option>';

    leave_types.forEach(lt => {
      const opt = document.createElement('option');
      opt.value       = lt.leave_type_id;
      opt.textContent = lt.leave_type_name;
      select.appendChild(opt);
    });

    // ── Render requests table ──────────────────────────────
    renderRequestsTable(requests, tbody);

  } catch (error) {
    console.error('Request page load error:', error);
    if (tbody) {
      tbody.innerHTML =
        `<tr class="empty-row">
           <td colspan="5">Unable to load requests. Please refresh.</td>
         </tr>`;
    }
  }
}

/* ── Table renderer ─────────────────────────────────────────── */

function renderRequestsTable(requests, tbody) {
  tbody.replaceChildren();

  if (!requests || requests.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = 'No requests found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const STATUS_CLASS = {
    Approved: 'status-badge--approved',
    Rejected: 'status-badge--rejected',
    Pending:  'status-badge--pending',
  };

  requests.forEach(r => {
    const tr = document.createElement('tr');

    // Store row data for the detail modal
    tr.dataset.reqNumber  = r.request_number;
    tr.dataset.leaveType  = r.leave_type_name;
    tr.dataset.start      = r.start_datetime ? r.start_datetime.slice(0, 10) : '';
    tr.dataset.end        = r.end_datetime   ? r.end_datetime.slice(0, 10)   : '';
    tr.dataset.days       = r.total_leave_days;
    tr.dataset.status     = r.status;

    // Request Number
    const tdNum = document.createElement('td');
    tdNum.textContent = r.request_number;

    // Date Filed
    const tdFiled = document.createElement('td');
    tdFiled.textContent = formatDate(r.date_filed);

    // Leave Dates
    const tdDates = document.createElement('td');
    const startFmt = formatDate(r.start_datetime ? r.start_datetime.slice(0, 10) : '');
    const endFmt   = formatDate(r.end_datetime   ? r.end_datetime.slice(0, 10)   : '');
    tdDates.textContent = `${startFmt} – ${endFmt}`;

    // Status badge
    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `status-badge ${STATUS_CLASS[r.status] ?? 'status-badge--pending'}`;
    badge.textContent = r.status;
    tdStatus.appendChild(badge);

    // View link
    const tdAction = document.createElement('td');
    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'view-request-btn';
    viewBtn.textContent = 'View';
    tdAction.appendChild(viewBtn);

    tr.append(tdNum, tdFiled, tdDates, tdStatus, tdAction);
    tbody.appendChild(tr);
  });
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
    $('totalLeaveDays').value  = '';
    $('leaveReason').value     = '';
    clearFormErrors();
    showModal('leaveFormModal');
  });

  // ── Date inputs → recalculate weekdays ────────────────────
  ['leaveStartDate', 'leaveEndDate'].forEach(id => {
    $(id).addEventListener('change', () => {
      const s = $('leaveStartDate').value;
      const e = $('leaveEndDate').value;
      $('totalLeaveDays').value = (s && e) ? countWeekdays(s, e) : '';
    });
  });

  // ── Cancel leave form ─────────────────────────────────────
  $('cancelLeaveFormBtn').addEventListener('click', () => hideModal('leaveFormModal'));

  // ── Review → validate then show review modal ──────────────
  $('reviewLeaveBtn').addEventListener('click', () => {
    clearFormErrors();

    const leaveTypeId   = $('leaveTypeSelect').value;
    const leaveTypeName = $('leaveTypeSelect').selectedOptions[0]?.text ?? '';
    const startDate     = $('leaveStartDate').value;
    const endDate       = $('leaveEndDate').value;
    const totalDays     = parseInt($('totalLeaveDays').value, 10);
    const reason        = $('leaveReason').value.trim();

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
    if (!reason) {
      showFieldError('leaveReason', 'Please provide a reason.');
      valid = false;
    }

    if (!valid) return;

    // Store for submission
    _pendingSubmit = { leaveTypeId, leaveTypeName, startDate, endDate, totalDays, reason };

    // Populate review modal
    $('reviewLeaveType').textContent = leaveTypeName;
    $('reviewStartDate').textContent = formatDate(startDate);
    $('reviewEndDate').textContent   = formatDate(endDate);
    $('reviewTotalDays').textContent = totalDays;
    $('reviewReason').textContent    = reason;

    hideModal('leaveFormModal');
    showModal('reviewLeaveModal');
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

  // ── View details from table (event delegation) ────────────
  document.getElementById('requestTableBody')
    .addEventListener('click', e => {
      const viewBtn = e.target.closest('.view-request-btn');
      if (!viewBtn) return;

      const tr = viewBtn.closest('tr');
      if (!tr) return;

      const status = tr.dataset.status;
      const noteMap = {
        Pending:  'Waiting for administrator approval.',
        Approved: 'Your leave has been approved.',
        Rejected: 'Your leave request was rejected.',
      };

      $('detailRequestNumber').textContent = tr.dataset.reqNumber;
      $('detailLeaveType').textContent     = tr.dataset.leaveType;
      $('detailStartDate').textContent     = formatDate(tr.dataset.start);
      $('detailEndDate').textContent       = formatDate(tr.dataset.end);
      $('detailTotalDays').textContent     = tr.dataset.days;
      $('detailStatus').textContent        = status;
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

/* ── Silently refresh the table after a successful submit ───── */

async function refreshTable() {
  const tbody = document.getElementById('requestTableBody');

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

    renderRequestsTable(result.data.requests, tbody);
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
  const start = new Date(startStr);
  const end   = new Date(endStr);
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
