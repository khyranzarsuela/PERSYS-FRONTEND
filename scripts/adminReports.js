/* ============================================================
   PERSYS — Admin Reports (Manual Excel Exports & Automated Monthly Job)
   1. Manual Export: Summary of Avail. Leave (.xlsx)
   2. Manual Export: Leave Reports (.xlsx)
   3. Automated Monthly Reports Job (1st of month -> expires after 3rd)
   ============================================================ */

const AUTH_ME_API = `${window.PERSYS_CONFIG.API_BASE_URL}/api/auth/me.php`;
const EXPORT_REPORTS_API = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/exportReports.php`;
const SC_SUMMARY_API = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/serviceCredits/summary.php`;
const SC_EMP_ACTIVITIES_API = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/serviceCredits/employeeActivities.php`;
const TX_API = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/transactions.php`;

/* ============================================================
   AUTOMATED MONTHLY REPORTS JOB — CUSTOMIZABLE CONFIG (TESTING)
   ============================================================
   How this job works in production (testMode.enabled = false):
   - On the 1st day of the month (once triggerTime is reached) through
     the 3rd day of the month (3-day window: Day 1, Day 2, Day 3),
     the bottom card automatically displays:
       "Here is your automated Monthly Reports by <Previous Month>"
     and generates the full previous month's Excel reports.
   - Outside Days 1–3 (e.g., November 30 or December 4+), the bottom
     card remains empty.

   How to customize for testing (set testMode.enabled = true):
   - simulatedDate: 'YYYY-MM-DD'
       • '2026-11-30' -> End of November (NOT displayed)
       • '2026-12-01' -> 1st of December (DISPLAYED, generates full November)
       • '2026-12-03' -> 3rd of December (DISPLAYED, last day before expiry)
       • '2026-12-04' -> 4th of December (EXPIRED, NOT displayed)
   - simulatedTime: 'HH:MM' (24-hour current time for testing triggerTime)
   - customReportMonth: null (auto = previous month, or set 1..12 to force a month, e.g. 11 for November)
   - customReportYear:  null (auto = year of target month, or set e.g. 2026)
   ============================================================ */
const AUTO_REPORT_JOB_CONFIG = {
  triggerDayStart: 1,      // 1st day of the month (e.g. Dec 1)
  expireDayEnd: 3,         // Expires after the 3rd day (Dec 1 - Dec 3 active)
  triggerTime: '00:00',    // 24-hour time (HH:MM) on Day 1 when the job triggers

  testMode: {
    enabled: true,                // <-- Set to true to test custom date, month, and time
    simulatedDate: '2026-12-01',   // <-- Customize simulated current date (YYYY-MM-DD)
    simulatedTime: '08:00',        // <-- Customize simulated current time (HH:MM, 24h)
    customReportMonth: null,       // <-- Optional: 1..12 (e.g. 11 = November), or null for automatic previous month
    customReportYear: null         // <-- Optional: e.g. 2026, or null for automatic year
  }
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Current active automated job target (populated when the job is within its 3-day window)
let activeAutoJobTarget = null;

document.addEventListener('DOMContentLoaded', async () => {
  const authorized = await window.PERSYSAdminGuard.ready;
  if (!authorized) return;

  loadAdminSidebarProfile();

  wireReportCard({
    monthSelectId: 'availLeaveMonth',
    startDateId: 'availLeaveStartDate',
    endDateId: 'availLeaveEndDate',
    exportBtnId: 'btnExportAvailLeave',
    reportType: 'summary_available_leave',
    defaultFilePrefix: 'Summary_of_Available_Leave_Report'
  });

  wireReportCard({
    monthSelectId: 'leaveReportMonth',
    startDateId: 'leaveReportStartDate',
    endDateId: 'leaveReportEndDate',
    exportBtnId: 'btnExportLeaveReports',
    reportType: 'leave_reports',
    defaultFilePrefix: 'Leave_Reports'
  });

  wireAutomatedMonthlyReportsJob();

  const pFlags = window.PERSYSAdminGuard.getPrincipalFeatures?.() || {};
  if (pFlags.is_principal && pFlags.show_records_in_reports) {
    initPrincipalReportsTables();
  }
});

async function loadAdminSidebarProfile() {
  const cachedUser = window.PERSYSSession?.user;
  if (cachedUser) {
    const usernameEl = document.getElementById('adminUsername');
    const roleEl = document.getElementById('adminRole');
    if (usernameEl && cachedUser.username) usernameEl.textContent = cachedUser.username;
    if (roleEl && cachedUser.role_name) roleEl.textContent = cachedUser.role_name;
  }

  try {
    const response = await fetch(AUTH_ME_API, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return;
    const result = await response.json();
    if (result?.success && result.data) {
      const usernameEl = document.getElementById('adminUsername');
      const roleEl = document.getElementById('adminRole');
      if (usernameEl) usernameEl.textContent = result.data.username || 'Admin';
      if (roleEl) roleEl.textContent = result.data.role_name || 'Admin';
    }
  } catch (err) {
    console.error('Admin sidebar load error:', err);
  }
}

/* ═══════════════════════════════════════════════════════════════
   AUTOMATED MONTHLY REPORTS JOB (1st to 3rd of the Month)
═══════════════════════════════════════════════════════════════ */

function wireAutomatedMonthlyReportsJob() {
  const btnAutoAvail = document.getElementById('btnAutoDownloadAvailLeave');
  const btnAutoLeave = document.getElementById('btnAutoDownloadLeaveReports');

  btnAutoAvail?.addEventListener('click', () => {
    if (!activeAutoJobTarget) return;
    downloadReportFile({
      reportType: 'summary_available_leave',
      monthVal: String(activeAutoJobTarget.reportMonth),
      startDate: activeAutoJobTarget.startDate,
      endDate: activeAutoJobTarget.endDate,
      defaultFilePrefix: `Automated_Summary_of_Available_Leave_${activeAutoJobTarget.monthName}_${activeAutoJobTarget.reportYear}`,
      triggerBtn: btnAutoAvail
    });
  });

  btnAutoLeave?.addEventListener('click', () => {
    if (!activeAutoJobTarget) return;
    downloadReportFile({
      reportType: 'leave_reports',
      monthVal: String(activeAutoJobTarget.reportMonth),
      startDate: activeAutoJobTarget.startDate,
      endDate: activeAutoJobTarget.endDate,
      defaultFilePrefix: `Automated_Leave_Reports_${activeAutoJobTarget.monthName}_${activeAutoJobTarget.reportYear}`,
      triggerBtn: btnAutoLeave
    });
  });

  // Evaluate immediately on page load and re-check every 15 seconds
  evaluateAndRenderAutomatedJob();
  setInterval(evaluateAndRenderAutomatedJob, 15000);
}

function getEffectiveNow() {
  const cfg = AUTO_REPORT_JOB_CONFIG;
  if (cfg.testMode && cfg.testMode.enabled) {
    const datePart = String(cfg.testMode.simulatedDate || '').trim();
    const timePart = String(cfg.testMode.simulatedTime || '00:00').trim();
    const parsed = new Date(`${datePart}T${timePart}:00`);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

function parseTimeToMinutes(hhmm) {
  const parts = String(hhmm || '00:00').trim().split(':');
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

function evaluateAutomatedJobWindow() {
  const cfg = AUTO_REPORT_JOB_CONFIG;
  const now = getEffectiveNow();

  const currentYear = now.getFullYear();
  const currentMonth1to12 = now.getMonth() + 1;
  const currentDay = now.getDate();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const startDay = Number(cfg.triggerDayStart) || 1;
  const endDay = Number(cfg.expireDayEnd) || 3;
  const triggerMinutes = parseTimeToMinutes(cfg.triggerTime);

  // Check if today is within [startDay, endDay] (e.g. 1st through 3rd of the month)
  const withinDays = currentDay >= startDay && currentDay <= endDay;
  const pastTriggerTime = currentDay > startDay || (currentDay === startDay && currentMinutes >= triggerMinutes);

  if (!withinDays || !pastTriggerTime) {
    return { isActive: false };
  }

  // Determine which month's full report to generate:
  // By default on the 1st-3rd of a month (e.g. Dec 1), generate for the previous month (November)
  let reportMonth = currentMonth1to12 - 1;
  let reportYear = currentYear;
  if (reportMonth < 1) {
    reportMonth = 12;
    reportYear = currentYear - 1;
  }

  if (cfg.testMode && cfg.testMode.enabled) {
    const customM = Number(cfg.testMode.customReportMonth);
    const customY = Number(cfg.testMode.customReportYear);
    if (customM >= 1 && customM <= 12) {
      reportMonth = customM;
    }
    if (customY >= 2000 && customY <= 2100) {
      reportYear = customY;
    }
  }

  const { firstDayYMD, lastDayYMD, lastDayNumber } = getMonthBoundsYMD(reportYear, reportMonth);
  const monthName = MONTH_NAMES[reportMonth - 1] || 'Month';
  const currentMonthName = MONTH_NAMES[currentMonth1to12 - 1] || '';

  return {
    isActive: true,
    reportMonth,
    reportYear,
    monthName,
    startDate: firstDayYMD,
    endDate: lastDayYMD,
    periodLabel: `${monthName} 1, ${reportYear} – ${monthName} ${lastDayNumber}, ${reportYear}`,
    expiryLabel: `Available until ${currentMonthName} ${endDay}, ${currentYear}`
  };
}

function evaluateAndRenderAutomatedJob() {
  const container = document.getElementById('autoReportsContainer');
  if (!container) return;

  const state = evaluateAutomatedJobWindow();

  if (!state.isActive) {
    activeAutoJobTarget = null;
    container.hidden = true;
    return;
  }

  activeAutoJobTarget = state;
  container.hidden = false;

  const headingEl = document.getElementById('autoReportsHeadingLabel');
  const subtitleEl = document.getElementById('autoReportsSubtitle');
  const expiryEl = document.getElementById('autoReportsExpiryBadge');
  const availPeriodEl = document.getElementById('autoAvailLeavePeriod');
  const leavePeriodEl = document.getElementById('autoLeaveReportsPeriod');

  if (headingEl) {
    headingEl.textContent = `Here is your automated Monthly Reports by ${state.monthName}`;
  }
  if (subtitleEl) {
    subtitleEl.textContent = `Covering full month of ${state.periodLabel}`;
  }
  if (expiryEl) {
    expiryEl.textContent = state.expiryLabel;
  }
  if (availPeriodEl) {
    availPeriodEl.textContent = `${state.periodLabel} (.xlsx)`;
  }
  if (leavePeriodEl) {
    leavePeriodEl.textContent = `${state.periodLabel} (.xlsx)`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   MANUAL CARD WIRING (Month <-> Start Date / End Date + Export)
═══════════════════════════════════════════════════════════════ */

function wireReportCard({
  monthSelectId,
  startDateId,
  endDateId,
  exportBtnId,
  reportType,
  defaultFilePrefix
}) {
  const monthEl = document.getElementById(monthSelectId);
  const startEl = document.getElementById(startDateId);
  const endEl = document.getElementById(endDateId);
  const exportBtn = document.getElementById(exportBtnId);

  if (!monthEl || !startEl || !endEl || !exportBtn) return;

  // When Month changes -> auto-fill Start Date (1st of month) & End Date (last day of month)
  monthEl.addEventListener('change', () => {
    const monthVal = Number(monthEl.value);
    if (!monthVal || monthVal < 1 || monthVal > 12) {
      startEl.removeAttribute('min');
      startEl.removeAttribute('max');
      endEl.removeAttribute('min');
      endEl.removeAttribute('max');
      return;
    }

    let year = new Date().getFullYear();
    if (startEl.value && /^\d{4}-\d{2}-\d{2}$/.test(startEl.value)) {
      year = Number(startEl.value.slice(0, 4)) || year;
    }

    const { firstDayYMD, lastDayYMD } = getMonthBoundsYMD(year, monthVal);

    startEl.min = firstDayYMD;
    startEl.max = lastDayYMD;
    endEl.min = firstDayYMD;
    endEl.max = lastDayYMD;

    startEl.value = firstDayYMD;
    endEl.value = lastDayYMD;
  });

  startEl.addEventListener('change', () => {
    if (!startEl.value) return;
    const parts = startEl.value.split('-');
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const monthNum = Number(parts[1]);
      if (monthNum >= 1 && monthNum <= 12 && String(monthEl.value) !== String(monthNum)) {
        monthEl.value = String(monthNum);
        const { firstDayYMD, lastDayYMD } = getMonthBoundsYMD(year, monthNum);
        startEl.min = firstDayYMD;
        startEl.max = lastDayYMD;
        endEl.min = firstDayYMD;
        endEl.max = lastDayYMD;
      }
      if (!endEl.value || endEl.value < startEl.value) {
        const { lastDayYMD } = getMonthBoundsYMD(year, monthNum);
        endEl.value = lastDayYMD;
      }
    }
  });

  endEl.addEventListener('change', () => {
    if (!endEl.value) return;
    const parts = endEl.value.split('-');
    if (parts.length === 3 && !monthEl.value) {
      const year = Number(parts[0]);
      const monthNum = Number(parts[1]);
      if (monthNum >= 1 && monthNum <= 12) {
        monthEl.value = String(monthNum);
        const { firstDayYMD, lastDayYMD } = getMonthBoundsYMD(year, monthNum);
        startEl.min = firstDayYMD;
        startEl.max = lastDayYMD;
        endEl.min = firstDayYMD;
        endEl.max = lastDayYMD;
        if (!startEl.value) startEl.value = firstDayYMD;
      }
    }
  });

  exportBtn.addEventListener('click', () =>
    handleManualExportExcel({
      monthEl,
      startEl,
      endEl,
      exportBtn,
      reportType,
      defaultFilePrefix
    })
  );
}

function getMonthBoundsYMD(year, month1to12) {
  const mm = String(month1to12).padStart(2, '0');
  const lastDay = new Date(year, month1to12, 0).getDate();
  const dd = String(lastDay).padStart(2, '0');
  return {
    firstDayYMD: `${year}-${mm}-01`,
    lastDayYMD: `${year}-${mm}-${dd}`,
    lastDayNumber: lastDay
  };
}

function handleManualExportExcel({
  monthEl,
  startEl,
  endEl,
  exportBtn,
  reportType,
  defaultFilePrefix
}) {
  const monthVal = monthEl.value.trim();
  const startDate = startEl.value.trim();
  const endDate = endEl.value.trim();

  if (!monthVal) {
    alert('Please select a Month first.');
    monthEl.focus();
    return;
  }

  if (!startDate) {
    alert('Please select a Start Date.');
    startEl.focus();
    return;
  }

  if (!endDate) {
    alert('Please select an End Date.');
    endEl.focus();
    return;
  }

  if (endDate < startDate) {
    alert('End Date cannot be earlier than Start Date.');
    endEl.focus();
    return;
  }

  const startMonth = Number(startDate.split('-')[1]);
  const endMonth = Number(endDate.split('-')[1]);
  if (startMonth !== Number(monthVal) || endMonth !== Number(monthVal)) {
    alert('Start Date and End Date must be within the selected Month.');
    return;
  }

  downloadReportFile({
    reportType,
    monthVal,
    startDate,
    endDate,
    defaultFilePrefix: `${defaultFilePrefix}_${startDate}_to_${endDate}`,
    triggerBtn: exportBtn
  });
}

async function downloadReportFile({
  reportType,
  monthVal,
  startDate,
  endDate,
  defaultFilePrefix,
  triggerBtn
}) {
  const originalHtml = triggerBtn ? triggerBtn.innerHTML : '';
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.textContent = 'Exporting...';
  }

  try {
    const params = new URLSearchParams({
      type: reportType,
      month: monthVal,
      start_date: startDate,
      end_date: endDate
    });

    const response = await fetch(`${EXPORT_REPORTS_API}?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store'
    });

    if (!response.ok) {
      let errMsg = `Unable to export Excel report (HTTP ${response.status}).`;
      try {
        const errJson = await response.json();
        if (errJson?.message) errMsg = errJson.message;
      } catch (_) {
        // Ignore JSON parse error
      }
      throw new Error(errMsg);
    }

    const blob = await response.blob();
    const excelBlob = new Blob([blob], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const filename = `${defaultFilePrefix}.xlsx`;
    const blobUrl = URL.createObjectURL(excelBlob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (err) {
    console.error('Report export error:', err);
    alert(err.message || 'Unable to export Excel report. Please try again.');
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = originalHtml;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   PRINCIPAL ("SUPER ADMIN") REPORTS TABLES:
   1. Personnel Service Credits Records (+ Activities View Modal)
   2. Leave Reports (Daily breakdown of Approved leave requests)
═══════════════════════════════════════════════════════════════ */

async function initPrincipalReportsTables() {
  const container = document.getElementById('principalReportsTablesContainer');
  if (!container) return;
  container.hidden = false;
  container.style.display = 'flex';

  let scRecords = [];
  let scFiltered = [];
  let scPage = 1;
  const scPerPage = 5;

  let lrRows = [];
  let lrFiltered = [];
  let lrPage = 1;
  const lrPerPage = 5;

  const scSearchEl = document.getElementById('repScPersonnelSearch');
  const lrSearchEl = document.getElementById('repLeaveReportsSearch');
  const actOverlay = document.getElementById('repActivitiesModalOverlay');
  const actCloseBtn = document.getElementById('repActivitiesCloseBtn');

  actCloseBtn?.addEventListener('click', () => {
    if (actOverlay) actOverlay.style.display = 'none';
  });
  actOverlay?.addEventListener('click', e => {
    if (e.target === actOverlay) actOverlay.style.display = 'none';
  });

  scSearchEl?.addEventListener('input', () => {
    const q = (scSearchEl.value || '').trim().toLowerCase();
    scFiltered = scRecords.filter(r =>
      !q ||
      String(r.employee_number || '').toLowerCase().includes(q) ||
      String(r.employee_name || '').toLowerCase().includes(q) ||
      String(r.role || '').toLowerCase().includes(q)
    );
    scPage = 1;
    renderPrincipalScRecordsTable();
  });

  lrSearchEl?.addEventListener('input', () => {
    const q = (lrSearchEl.value || '').trim().toLowerCase();
    lrFiltered = lrRows.filter(r =>
      !q ||
      String(r.employee_number || '').toLowerCase().includes(q) ||
      String(r.employee_name || '').toLowerCase().includes(q) ||
      String(r.type_of_leave || '').toLowerCase().includes(q) ||
      String(r.inclusive_date || '').toLowerCase().includes(q)
    );
    lrPage = 1;
    renderPrincipalLeaveReportsTable();
  });

  try {
    const [scRes, txRes] = await Promise.all([
      fetch(SC_SUMMARY_API, { method: 'GET', credentials: 'include', cache: 'no-store' }),
      fetch(TX_API, { method: 'GET', credentials: 'include', cache: 'no-store' })
    ]);

    const scJson = await scRes.json().catch(() => null);
    if (scJson?.success && Array.isArray(scJson.data?.personnel_records)) {
      scRecords = scJson.data.personnel_records;
      scFiltered = [...scRecords];
      renderPrincipalScRecordsTable();
    }

    const txJson = await txRes.json().catch(() => null);
    if (txJson?.success && Array.isArray(txJson.data?.requests)) {
      lrRows = expandApprovedLeavesForReport(txJson.data.requests);
      lrFiltered = [...lrRows];
      renderPrincipalLeaveReportsTable();
    }
  } catch (err) {
    console.error('Principal reports tables load error:', err);
  }

  function fmtNum(v) {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  }

  function renderPrincipalScRecordsTable() {
    const tbody = document.getElementById('repScPersonnelTableBody');
    const pagBar = document.getElementById('repScPersonnelPagination');
    if (!tbody) return;
    tbody.replaceChildren();

    const total = scFiltered.length;
    const totalPages = Math.max(1, Math.ceil(total / scPerPage));
    scPage = Math.min(Math.max(1, scPage), totalPages);

    if (total === 0) {
      tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;padding:24px;color:#9ca3af;font-style:italic;">No personnel service credit records found.</td></tr>`;
      if (pagBar) pagBar.innerHTML = '';
      return;
    }

    const start = (scPage - 1) * scPerPage;
    const slice = scFiltered.slice(start, start + scPerPage);

    slice.forEach(r => {
      const tr = document.createElement('tr');
      const cells = [
        r.employee_number || '—',
        r.employee_name || '—',
        r.role || '—',
        fmtNum(r.balance_national),
        fmtNum(r.balance_wellness),
        fmtNum(r.balance_local),
        fmtNum(r.earned_national),
        fmtNum(r.earned_wellness),
        fmtNum(r.earned_local),
        fmtNum(r.used_national),
        fmtNum(r.used_wellness),
        fmtNum(r.used_local)
      ];
      cells.forEach((val, idx) => {
        const td = document.createElement('td');
        td.textContent = val;
        if (idx >= 3) td.style.fontWeight = idx < 6 ? '800' : '600';
        tr.appendChild(td);
      });

      const tdAct = document.createElement('td');
      tdAct.style.textAlign = 'center';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rep-view-btn';
      btn.textContent = 'View';
      btn.addEventListener('click', () => openEmployeeActivitiesModal(r));
      tdAct.appendChild(btn);
      tr.appendChild(tdAct);

      tbody.appendChild(tr);
    });

    renderSimplePagination(pagBar, scPage, totalPages, total, scPerPage, nextP => {
      scPage = nextP;
      renderPrincipalScRecordsTable();
    });
  }

  async function openEmployeeActivitiesModal(empRecord) {
    const nameEl = document.getElementById('repActivitiesEmpName');
    const tbody = document.getElementById('repActivitiesTableBody');
    if (nameEl) nameEl.textContent = empRecord.employee_name || 'Employee';
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:18px;color:#9ca3af;">Loading activities...</td></tr>`;
    if (actOverlay) actOverlay.style.display = 'flex';

    try {
      const res = await fetch(`${SC_EMP_ACTIVITIES_API}?employee_id=${encodeURIComponent(empRecord.employee_id)}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      });
      const json = await res.json();
      const activities = Array.isArray(json?.data?.activities) ? json.data.activities : [];
      if (!tbody) return;
      tbody.replaceChildren();
      if (!activities.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:18px;color:#9ca3af;font-style:italic;">No service credit activities found for this employee.</td></tr>`;
        return;
      }
      activities.forEach(a => {
        const tr = document.createElement('tr');
        const tdAct = document.createElement('td');
        tdAct.textContent = a.activity_name || '—';
        const tdDt = document.createElement('td');
        tdDt.textContent = a.activity_dates || a.activity_start_date || '—';
        const tdPts = document.createElement('td');
        tdPts.textContent = fmtNum(a.credit_amount);
        const tdType = document.createElement('td');
        tdType.textContent = a.credit_type_name || a.credit_type || '—';
        tr.append(tdAct, tdDt, tdPts, tdType);
        tbody.appendChild(tr);
      });
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:18px;color:#DC2626;">Unable to load activities.</td></tr>`;
    }
  }

  function renderPrincipalLeaveReportsTable() {
    const tbody = document.getElementById('repLeaveReportsTableBody');
    const pagBar = document.getElementById('repLeaveReportsPagination');
    if (!tbody) return;
    tbody.replaceChildren();

    const total = lrFiltered.length;
    const totalPages = Math.max(1, Math.ceil(total / lrPerPage));
    lrPage = Math.min(Math.max(1, lrPage), totalPages);

    if (total === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#9ca3af;font-style:italic;">No approved leave reports found.</td></tr>`;
      if (pagBar) pagBar.innerHTML = '';
      return;
    }

    const start = (lrPage - 1) * lrPerPage;
    const slice = lrFiltered.slice(start, start + lrPerPage);

    slice.forEach(item => {
      const tr = document.createElement('tr');
      [item.employee_number, item.employee_name, item.date_applied, item.inclusive_date, item.type_of_leave].forEach(val => {
        const td = document.createElement('td');
        td.textContent = val || '—';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    renderSimplePagination(pagBar, lrPage, totalPages, total, lrPerPage, nextP => {
      lrPage = nextP;
      renderPrincipalLeaveReportsTable();
    });
  }

  function renderSimplePagination(bar, page, totalPages, total, perPage, onPageChange) {
    if (!bar) return;
    bar.replaceChildren();
    const start = (page - 1) * perPage + 1;
    const end = Math.min(page * perPage, total);

    const info = document.createElement('span');
    info.className = 'rep-pag-info';
    info.textContent = `Showing ${start}–${end} of ${total} records`;

    const controls = document.createElement('div');
    controls.className = 'rep-pag-controls';

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'rep-pag-btn';
    prev.textContent = '‹';
    prev.disabled = page <= 1;
    prev.addEventListener('click', () => onPageChange(page - 1));
    controls.appendChild(prev);

    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 7 && i > 2 && i < totalPages - 1 && Math.abs(i - page) > 1) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rep-pag-btn' + (i === page ? ' is-active' : '');
      b.textContent = String(i);
      b.addEventListener('click', () => onPageChange(i));
      controls.appendChild(b);
    }

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'rep-pag-btn';
    next.textContent = '›';
    next.disabled = page >= totalPages;
    next.addEventListener('click', () => onPageChange(page + 1));
    controls.appendChild(next);

    bar.append(info, controls);
  }

  function expandApprovedLeavesForReport(requests) {
    const rows = [];
    const approved = (requests || []).filter(r => String(r.status || '').toLowerCase() === 'approved');
    approved.forEach(r => {
      const empNumber = r.employee_number || '—';
      const empName = [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ').trim() || '—';
      const dateApplied = r.date_filed
        ? new Date(String(r.date_filed).replace(' ', 'T')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';
      const cid = String(r.credit_type_id ?? '');
      const typeOfLeave = r.credit_type_name
        ? String(r.credit_type_name).toUpperCase()
        : (cid === '1' ? 'LOCAL' : cid === '2' ? 'NATIONAL' : cid === '3' ? 'WELLNESS' : '—');

      const sParts = String(r.start_datetime || '').slice(0, 10).split('-').map(Number);
      const eParts = String(r.end_datetime || r.start_datetime || '').slice(0, 10).split('-').map(Number);
      if (sParts.length !== 3) return;
      const cur = new Date(sParts[0], sParts[1] - 1, sParts[2]);
      const endDt = eParts.length === 3 ? new Date(eParts[0], eParts[1] - 1, eParts[2]) : new Date(cur);
      let safety = 0;
      while (cur <= endDt && safety < 366) {
        rows.push({
          employee_number: empNumber,
          employee_name: empName,
          date_applied: dateApplied,
          inclusive_date: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          type_of_leave: typeOfLeave
        });
        cur.setDate(cur.getDate() + 1);
        safety++;
      }
    });
    return rows;
  }
}
