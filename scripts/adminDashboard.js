/* ============================================================
   PERSYS — Admin Dashboard
   - Live Topbar Date & Clock
   - 3 Horizontal Stat Cards
   - Scrollable Pending Leave Requests Table + Read-Only View Modal
   ============================================================ */

const DASHBOARD_API =
  `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/dashboard.php`;
const FORM6_BASE =
  `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/generateForm6.php`;
const ADMIN_PROFILE_EDIT_REQ_API =
  `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/profileEditRequests.php`;
const USER_DASHBOARD_API =
  `${window.PERSYS_CONFIG.API_BASE_URL}/api/user/dashboard.php`;
const USER_PROFILE_EDIT_REQ_API =
  `${window.PERSYS_CONFIG.API_BASE_URL}/api/user/profileEditRequests.php`;
const CALENDAR_OVERLAPS_API =
  `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/calendarOverlaps.php`;

let dashboardPendingRequests = [];
let adminProfileEditRequests = [];
let activeEditRequestRecord = null;
let editReqSearchDebounce = null;

document.addEventListener("DOMContentLoaded", async () => {
  startTopbarClock();

  const authorized = await window.PERSYSAdminGuard.ready;
  if (!authorized) {
    return;
  }

  const pFlags = window.PERSYSAdminGuard.getPrincipalFeatures?.() || {};
  if (pFlags.is_principal && pFlags.use_personal_dashboard) {
    activatePrincipalDashboardMode();
    return;
  }

  wireDashboardRequestModal();
  wireAdminEditRequestSection();
  window.PERSYSGlobalCalendar?.mount("calendarHolidaysCard", { large: true });
  await Promise.all([
    loadDashboard(),
    loadRecentEditRequests()
  ]);
});

/* ═══════════════════════════════════════════════════════════════
   PRINCIPAL ("SUPER ADMIN") PERSONAL DASHBOARD MODE
═══════════════════════════════════════════════════════════════ */

async function activatePrincipalDashboardMode() {
  const topRow = document.querySelector(".dashboard-top-row");
  const bottomRow = document.querySelector(".dashboard-bottom-row");
  const principalView = document.getElementById("principalDashboardView");

  if (topRow) topRow.style.display = "none";
  if (bottomRow) bottomRow.style.display = "none";
  if (principalView) {
    principalView.hidden = false;
    principalView.style.display = "flex";
  }

  wirePrincipalRequestEditModal();
  window.PERSYSGlobalCalendar?.mount("principalGlobalCalendarCard", { large: true });

  try {
    const response = await fetch(USER_DASHBOARD_API, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    const checked = await window.PERSYSApiErrors.handleResponse(response);
    if (!checked) return;

    const result = await checked.json();
    if (!result || !result.success || !result.data) return;

    const data = result.data;
    const username = data.user?.username || "Principal";
    const roleName = data.user?.role_name || "Principal";

    setText("adminUsername", username);
    setText("adminRole", roleName);
    setText("principalWelcomeName", username);

    const sc = data.service_credits || {};
    setText("pDashNationalBal", Number(sc.national ?? 0).toFixed(2));
    setText("pDashWellnessBal", Number(sc.wellness ?? 0).toFixed(2));
    setText("pDashLocalBal", Number(sc.local ?? 0).toFixed(2));

    const st = data.stats || {};
    const pending = Number(st.pending ?? 0);
    const approved = Number(st.approved ?? 0);
    const disapproved = Number(st.rejected ?? 0);

    setText("pDashPendingCount", String(pending));
    setText("pDashPendingSub", pending > 0 ? `${pending} pending` : "No pending requests");

    setText("pDashApprovedCount", String(approved));
    setText("pDashApprovedSub", approved > 0 ? `${approved} approved` : "No approved requests");

    setText("pDashDisapprovedCount", String(disapproved));
    setText("pDashDisapprovedSub", disapproved > 0 ? `${disapproved} disapproved` : "No disapproved requests");
  } catch (err) {
    console.error("Principal personal dashboard load error:", err);
  }
}

function wirePrincipalRequestEditModal() {
  const openBtn = document.getElementById("btnPrincipalRequestEditProfile");
  const overlay = document.getElementById("principalReqEditModalOverlay");
  const closeBtn = document.getElementById("principalReqEditCloseBtn");
  const cancelBtn = document.getElementById("principalReqEditCancelBtn");
  const form = document.getElementById("principalReqEditForm");
  const catEl = document.getElementById("principalReqEditCategory");
  const msgEl = document.getElementById("principalReqEditMessage");
  const fbEl = document.getElementById("principalReqEditFeedback");
  const submitBtn = document.getElementById("principalReqEditSubmitBtn");

  function close() {
    overlay?.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  openBtn?.addEventListener("click", () => {
    if (fbEl) {
      fbEl.textContent = "";
      fbEl.className = "edit-req-feedback";
    }
    overlay?.classList.add("is-open");
    document.body.style.overflow = "hidden";
    msgEl?.focus();
  });

  closeBtn?.addEventListener("click", close);
  cancelBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const category = (catEl?.value || "Personal Information").trim();
    const message = (msgEl?.value || "").trim();

    if (message.length < 5) {
      if (fbEl) {
        fbEl.textContent = "Please enter at least 5 characters describing the requested changes.";
        fbEl.className = "edit-req-feedback is-error";
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
    }

    try {
      const res = await fetch(USER_PROFILE_EDIT_REQ_API, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ category, message })
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result || !result.success) {
        throw new Error(result?.message || "Unable to submit profile edit request.");
      }

      if (msgEl) msgEl.value = "";
      if (fbEl) {
        fbEl.textContent = result.message || "Your profile edit request has been sent.";
        fbEl.className = "edit-req-feedback is-success";
      }
      setTimeout(close, 850);
    } catch (err) {
      if (fbEl) {
        fbEl.textContent = err.message || "Unable to submit profile edit request.";
        fbEl.className = "edit-req-feedback is-error";
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Request";
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   LIVE TOPBAR DATE & CLOCK
═══════════════════════════════════════════════════════════════ */

function startTopbarClock() {
  const dateEl = document.getElementById("topbarLiveDate");
  const timeEl = document.getElementById("topbarLiveTime");
  if (!dateEl && !timeEl) return;

  function updateClock() {
    const now = new Date();
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    }
    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });
    }
  }

  updateClock();
  setInterval(updateClock, 1000);
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD DATA LOADING
═══════════════════════════════════════════════════════════════ */

async function loadDashboard() {
  const tbody = document.getElementById("pendingLeaveTableBody");

  try {
    let response;
    try {
      response = await fetch(DASHBOARD_API, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });
    } catch (error) {
      window.PERSYSApiErrors.handleNetworkError(error);
      return;
    }

    const checkedResponse =
      await window.PERSYSApiErrors.handleResponse(response);
    if (!checkedResponse) {
      return;
    }

    const result = await checkedResponse.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Unable to load dashboard.");
    }

    const data = result.data;

    const usernameEl = document.getElementById("adminUsername");
    const roleEl = document.getElementById("adminRole");
    if (usernameEl) usernameEl.textContent = data.admin.username;
    if (roleEl) roleEl.textContent = data.admin.role_name;

    const teachEl = document.querySelector('[data-stat="active-teaching"]');
    const nonTeachEl = document.querySelector('[data-stat="active-nonteaching"]');
    const pendingEl = document.querySelector('[data-stat="pending-leave"]');

    if (teachEl) teachEl.textContent = data.statistics.active_teaching;
    if (nonTeachEl) nonTeachEl.textContent = data.statistics.active_non_teaching;
    if (pendingEl) pendingEl.textContent = data.statistics.pending_leave;

    dashboardPendingRequests = Array.isArray(data.recent_leave_requests)
      ? data.recent_leave_requests
      : [];

    renderPendingRequestsTable(dashboardPendingRequests, tbody);
  } catch (error) {
    console.error("Dashboard loading error:", error);
    if (tbody) {
      tbody.innerHTML =
        `<tr><td colspan="4" style="text-align:center; padding:18px; color:#9ca3af;">
           Unable to load pending leave requests. Please refresh.
         </td></tr>`;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   PENDING LEAVE REQUESTS TABLE
═══════════════════════════════════════════════════════════════ */

function renderPendingRequestsTable(requests, tbody) {
  if (!tbody) return;
  tbody.replaceChildren();

  if (!requests || requests.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.style.cssText = "text-align:center; padding:22px; color:#9ca3af; font-style:italic;";
    td.textContent = "No pending leave requests.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  requests.forEach((req) => {
    const tr = document.createElement("tr");

    // Col 1: Date Filed (MM/DD/YYYY)
    const tdDateFiled = document.createElement("td");
    tdDateFiled.textContent = formatSlashDate(req.date_filed || req.start_datetime);

    // Col 2: Request No. (#LR-...)
    const tdReqNo = document.createElement("td");
    const rawNum = String(req.request_number || req.leave_request_id || "—").trim();
    tdReqNo.textContent = rawNum.startsWith("#") ? rawNum : `#${rawNum}`;

    // Col 3: Name
    const tdName = document.createElement("td");
    tdName.textContent = buildFullName(req);

    // Col 4: Details (Green pill View button)
    const tdDetails = document.createElement("td");
    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "dash-view-pill-btn";
    viewBtn.textContent = "View";
    viewBtn.addEventListener("click", () => openDashboardRequestModal(req));
    tdDetails.appendChild(viewBtn);

    tr.append(tdDateFiled, tdReqNo, tdName, tdDetails);
    tbody.appendChild(tr);
  });
}

/* ═══════════════════════════════════════════════════════════════
   READ-ONLY REQUEST DETAILS MODAL & FORM 6
═══════════════════════════════════════════════════════════════ */

function wireDashboardRequestModal() {
  const overlay = document.getElementById("dashRequestModalOverlay");
  const closeBtn = document.getElementById("dashModalClose");
  const closeFooterBtn = document.getElementById("dashModalCloseFooter");
  const form6Btn = document.getElementById("dashModalForm6");

  closeBtn?.addEventListener("click", closeDashboardRequestModal);
  closeFooterBtn?.addEventListener("click", closeDashboardRequestModal);

  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) closeDashboardRequestModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay?.classList.contains("is-open")) {
      closeDashboardRequestModal();
    }
  });

  form6Btn?.addEventListener("click", () => {
    const ridEl = document.getElementById("dashModalRequestId");
    if (ridEl && ridEl.value) {
      openForm6FromDashboard(ridEl.value, form6Btn);
    }
  });
}

function openDashboardRequestModal(req) {
  const overlay = document.getElementById("dashRequestModalOverlay");
  const modal = document.getElementById("dashRequestModal");
  if (!overlay || !modal) return;

  const ridEl = document.getElementById("dashModalRequestId");
  if (ridEl) ridEl.value = req.leave_request_id || "";

  setText("dashRequestNumber", req.request_number || req.leave_request_id);
  setText("dashStatusText", req.status || "Pending");
  setText("dashEmployeeName", buildFullName(req));
  setText("dashEmployeeNumber", req.employee_number || "—");
  setText("dashPosition", req.position || req.personnel_type || "—");
  setText("dashLeaveType", req.leave_type_name || "—");
  setText("dashReason", req.reason_details || "Not provided");
  setText("dashStartDate", formatDateLong(req.start_datetime));
  setText("dashEndDate", formatDateLong(req.end_datetime));
  setText(
    "dashTotalDays",
    req.total_leave_days ? `${req.total_leave_days} Days` : "—"
  );
  setText("dashCreditType", req.credit_type_name || "Not selected");

  const statusBadge = document.getElementById("dashModalStatusBadge");
  if (statusBadge) {
    statusBadge.textContent = `Status: ${req.status || "Pending"}`;
  }

  checkDashboardLeaveOverlaps(req);

  overlay.classList.add("is-open");
  document.body.style.overflow = "hidden";
  modal.focus();
}

async function checkDashboardLeaveOverlaps(req) {
  const banner = document.getElementById("dashOverlapWarningBanner");
  if (!banner) return;
  banner.style.display = "none";
  banner.textContent = "";

  const startYmd = String(req.start_datetime || "").slice(0, 10);
  const endYmd   = String(req.end_datetime || startYmd).slice(0, 10);
  const leaveId  = req.leave_request_id || "";
  if (!startYmd) return;

  try {
    const params = new URLSearchParams({
      start: startYmd,
      end: endYmd || startYmd,
      leave_id: String(leaveId)
    });
    const res = await fetch(`${CALENDAR_OVERLAPS_API}?${params.toString()}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result || !result.success || !result.data) return;

    const overlaps = Array.isArray(result.data.overlaps) ? result.data.overlaps : [];
    if (overlaps.length === 0) return;

    const itemsText = overlaps
      .slice(0, 4)
      .map((o) => `${o.employee_name} (${o.leave_type_name}, ${o.start_date} to ${o.end_date})`)
      .join("; ");
    const extra = overlaps.length > 4 ? ` and ${overlaps.length - 4} more` : "";

    banner.style.display = "block";
    banner.textContent = `Schedule Overlap Notice: ${overlaps.length} other personnel already on approved leave during these dates — ${itemsText}${extra}.`;
  } catch {
    // Non-blocking warning check
  }
}

function closeDashboardRequestModal() {
  document.getElementById("dashRequestModalOverlay")?.classList.remove("is-open");
  document.body.style.overflow = "";
}

async function openForm6FromDashboard(rid, triggerBtn = null) {
  const req = dashboardPendingRequests.find(
    (x) => String(x.leave_request_id) === String(rid)
  );

  const originalHtml = triggerBtn ? triggerBtn.innerHTML : "";
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.textContent = "Generating...";
  }

  try {
    const url = `${FORM6_BASE}?request_id=${encodeURIComponent(rid)}`;
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/pdf" }
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        errText.trim() || `Unable to generate Form 6 (HTTP ${response.status}).`
      );
    }

    const rawBlob = await response.blob();
    const pdfBlob = new Blob([rawBlob], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(pdfBlob);

    const safeReqNum = String(req?.request_number || rid).replace(
      /[^A-Za-z0-9_-]/g,
      "_"
    );
    const filename = `Form6_${safeReqNum}.pdf`;

    const newWin = window.open(blobUrl, "_blank");
    if (!newWin || newWin.closed || typeof newWin.closed === "undefined") {
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (err) {
    console.error("Form 6 generation error:", err);
    alert(err.message || "Unable to generate Form 6. Please try again.");
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = originalHtml;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════ */

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "—";
}

function buildFullName(r) {
  return (
    [r.first_name, r.middle_name, r.last_name]
      .filter((v) => v && String(v).trim())
      .join(" ")
      .trim() || "—"
  );
}

function formatSlashDate(value) {
  if (!value) return "—";
  const ymd = String(value).trim().slice(0, 10);
  const parts = ymd.split("-");
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    return `${mm}/${dd}/${yyyy}`;
  }
  const d = new Date(String(value).replace(" ", "T"));
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });
}

function formatDateLong(value) {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

/* ═══════════════════════════════════════════════════════════════
   RECENT EDIT REQUEST CARD & REVIEW MODAL (LOCAL JSON STORE)
═══════════════════════════════════════════════════════════════ */

function wireAdminEditRequestSection() {
  const searchInput = document.getElementById("editReqSearchInput");
  const statusSelect = document.getElementById("editReqStatusFilter");
  const overlay = document.getElementById("adminEditReqModalOverlay");
  const closeBtn = document.getElementById("adminEditReqModalClose");
  const closeFooterBtn = document.getElementById("adminEditReqCloseFooter");
  const resolveBtn = document.getElementById("btnResolveEditReq");
  const declineBtn = document.getElementById("btnDeclineEditReq");

  searchInput?.addEventListener("input", () => {
    clearTimeout(editReqSearchDebounce);
    editReqSearchDebounce = setTimeout(() => {
      loadRecentEditRequests();
    }, 220);
  });

  statusSelect?.addEventListener("change", () => {
    loadRecentEditRequests();
  });

  closeBtn?.addEventListener("click", closeAdminEditReqModal);
  closeFooterBtn?.addEventListener("click", closeAdminEditReqModal);

  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) closeAdminEditReqModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay?.classList.contains("is-open")) {
      closeAdminEditReqModal();
    }
  });

  resolveBtn?.addEventListener("click", () => {
    submitAdminEditReqDecision("RESOLVED");
  });

  declineBtn?.addEventListener("click", () => {
    submitAdminEditReqDecision("DECLINED");
  });
}

async function loadRecentEditRequests() {
  const listEl = document.getElementById("recentEditRequestList");
  const badgeEl = document.getElementById("editReqPendingBadge");
  const searchVal = (document.getElementById("editReqSearchInput")?.value || "").trim();
  const statusVal = (document.getElementById("editReqStatusFilter")?.value || "ALL").trim();

  try {
    const params = new URLSearchParams();
    if (statusVal && statusVal !== "ALL") {
      params.set("status", statusVal);
    }
    if (searchVal !== "") {
      params.set("search", searchVal);
    }

    const url = params.toString()
      ? `${ADMIN_PROFILE_EDIT_REQ_API}?${params.toString()}`
      : ADMIN_PROFILE_EDIT_REQ_API;

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    if (response.status === 401 || response.status === 403) {
      await window.PERSYSApiErrors.handleResponse(response);
      return;
    }

    const result = await response.json().catch(() => null);
    if (!response.ok || !result || !result.success) {
      throw new Error(result?.message || "Unable to load profile edit requests.");
    }

    const pendingCount = Number(result.data?.pending_count || 0);
    if (badgeEl) {
      badgeEl.textContent = `${pendingCount} Pending`;
      badgeEl.classList.toggle("is-zero", pendingCount === 0);
    }

    adminProfileEditRequests = Array.isArray(result.data?.requests)
      ? result.data.requests
      : [];

    renderRecentEditRequestsList(adminProfileEditRequests, listEl);
  } catch (err) {
    console.error("Profile edit requests loading error:", err);
    if (listEl) {
      listEl.innerHTML = `<div class="recent-edit-empty">Unable to load profile edit requests.</div>`;
    }
  }
}

function renderRecentEditRequestsList(requests, listEl) {
  if (!listEl) return;
  listEl.replaceChildren();

  if (!requests || requests.length === 0) {
    const empty = document.createElement("div");
    empty.className = "recent-edit-empty";
    empty.textContent = "No profile edit requests found.";
    listEl.appendChild(empty);
    return;
  }

  requests.forEach((req) => {
    const row = document.createElement("div");
    row.className = "recent-edit-row";
    row.setAttribute("role", "listitem");

    // Purple circle avatar with 2-letter initials
    const avatar = document.createElement("div");
    avatar.className = "recent-edit-avatar";
    avatar.textContent = getInitials(req.employee_name);

    // Light-purple bar
    const bar = document.createElement("div");
    bar.className = "recent-edit-bar";

    const barMain = document.createElement("div");
    barMain.className = "recent-edit-bar-main";

    const barText = document.createElement("span");
    barText.className = "recent-edit-bar-text";

    const strongName = document.createElement("strong");
    strongName.textContent = req.employee_name || req.employee_id || "Employee";

    const summaryText = buildEditReqSummaryText(req);
    barText.appendChild(strongName);
    barText.appendChild(document.createTextNode(` \u2014 ${summaryText}`));
    barMain.appendChild(barText);

    // Show status tag if Resolved or Declined (or Pending)
    const statusUpper = String(req.status || "PENDING").toUpperCase();
    if (statusUpper !== "PENDING") {
      const statusTag = document.createElement("span");
      statusTag.className = `recent-edit-status-tag status-${statusUpper.toLowerCase()}`;
      statusTag.textContent = statusUpper;
      barMain.appendChild(statusTag);
    }

    // Speech bubble icon button on right
    const msgBtn = document.createElement("button");
    msgBtn.type = "button";
    msgBtn.className = "recent-edit-msg-btn";
    msgBtn.title = `View request ${req.request_id || ""}`;
    msgBtn.setAttribute("aria-label", `View profile edit request from ${req.employee_name || "employee"}`);
    msgBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        <circle cx="8.5" cy="10" r="1.25"></circle>
        <circle cx="12" cy="10" r="1.25"></circle>
        <circle cx="15.5" cy="10" r="1.25"></circle>
      </svg>
    `;

    row.addEventListener("click", () => {
      openAdminEditReqModal(req);
    });

    bar.append(barMain, msgBtn);
    row.append(avatar, bar);
    listEl.appendChild(row);
  });
}

function buildEditReqSummaryText(req) {
  const msg = String(req.message || "").trim().replace(/\s+/g, " ");
  if (msg.length > 0) {
    return msg.length > 52 ? `${msg.slice(0, 52)}...` : msg;
  }
  const cat = String(req.category || "Profile").trim();
  return `Requested ${cat.toLowerCase()} update`;
}

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "EM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function openAdminEditReqModal(req) {
  const overlay = document.getElementById("adminEditReqModalOverlay");
  const modal = document.getElementById("adminEditReqModal");
  if (!overlay || !modal) return;

  activeEditRequestRecord = req;

  const idInput = document.getElementById("adminEditReqId");
  if (idInput) idInput.value = req.request_id || "";

  setText("adminEditReqNumber", req.request_id || "—");
  setText("adminEditReqEmpName", req.employee_name || "—");
  setText("adminEditReqEmpId", req.employee_id || "—");
  setText("adminEditReqCategory", req.category || "—");
  setText("adminEditReqCreatedAt", formatDateTimeReadable(req.created_at));

  const statusUpper = String(req.status || "PENDING").toUpperCase();
  let statusDisplay = statusUpper;
  if (req.resolved_by && req.resolved_at) {
    statusDisplay = `${statusUpper} (by ${req.resolved_by} on ${formatDateTimeReadable(req.resolved_at)})`;
  }
  setText("adminEditReqStatusText", statusDisplay);

  const msgBox = document.getElementById("adminEditReqMessage");
  if (msgBox) {
    msgBox.textContent = req.message || "—";
  }

  const noteInput = document.getElementById("adminEditReqNoteInput");
  if (noteInput) {
    noteInput.value = req.admin_note || "";
  }

  const jumpLink = document.getElementById("adminEditReqJumpLink");
  if (jumpLink) {
    const empParam = encodeURIComponent(req.employee_id || req.employee_name || "");
    jumpLink.href = empParam
      ? `adminEmployees.html?search=${empParam}`
      : "adminEmployees.html";
  }

  hideAdminEditReqFeedback();

  overlay.classList.add("is-open");
  document.body.style.overflow = "hidden";
  modal.focus();
}

function closeAdminEditReqModal() {
  document.getElementById("adminEditReqModalOverlay")?.classList.remove("is-open");
  document.body.style.overflow = "";
  activeEditRequestRecord = null;
}

function showAdminEditReqFeedback(message, isError = false) {
  const fb = document.getElementById("adminEditReqFeedback");
  if (!fb) return;
  fb.textContent = message;
  fb.className = `edit-req-feedback ${isError ? "is-error" : "is-success"}`;
}

function hideAdminEditReqFeedback() {
  const fb = document.getElementById("adminEditReqFeedback");
  if (!fb) return;
  fb.textContent = "";
  fb.className = "edit-req-feedback";
}

async function submitAdminEditReqDecision(newStatus) {
  const requestId = document.getElementById("adminEditReqId")?.value || "";
  if (!requestId) return;

  const noteInput = document.getElementById("adminEditReqNoteInput");
  const adminNote = noteInput ? noteInput.value.trim() : "";
  const resolveBtn = document.getElementById("btnResolveEditReq");
  const declineBtn = document.getElementById("btnDeclineEditReq");

  hideAdminEditReqFeedback();

  if (resolveBtn) resolveBtn.disabled = true;
  if (declineBtn) declineBtn.disabled = true;

  try {
    const response = await fetch(ADMIN_PROFILE_EDIT_REQ_API, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        request_id: requestId,
        status: newStatus,
        admin_note: adminNote !== "" ? adminNote : null
      })
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result || !result.success) {
      throw new Error(result?.message || `Failed to update request (HTTP ${response.status}).`);
    }

    showAdminEditReqFeedback(
      newStatus === "RESOLVED"
        ? "Request marked as Resolved."
        : "Request has been Declined.",
      false
    );

    await loadRecentEditRequests();

    setTimeout(() => {
      closeAdminEditReqModal();
    }, 650);
  } catch (err) {
    console.error("Error updating profile edit request:", err);
    showAdminEditReqFeedback(err.message || "Unable to update request.", true);
  } finally {
    if (resolveBtn) resolveBtn.disabled = false;
    if (declineBtn) declineBtn.disabled = false;
  }
}

function formatDateTimeReadable(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}
