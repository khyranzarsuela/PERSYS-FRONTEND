/* ============================================================
   PERSYS — Admin Reports (Manual Excel Exports & Automated Monthly Job)
   1. Manual Export: Summary of Avail. Leave (.xlsx)
   2. Manual Export: Leave Reports (.xlsx)
   3. Automated Monthly Reports Job (1st of month -> expires after 3rd)
   ============================================================ */

const AUTH_ME_API = `${window.PERSYS_CONFIG.API_BASE_URL}/api/auth/me.php`;
const EXPORT_REPORTS_API = `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/exportReports.php`;

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
    enabled: false,                // <-- Set to true to test custom date, month, and time
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
