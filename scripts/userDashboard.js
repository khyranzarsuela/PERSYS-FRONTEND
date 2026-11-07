/* ============================================================
   PERSYS — User Dashboard
   Fetches data from /api/user/dashboard.php and populates
   the dashboard stat cards, service credit balances, and the
   recent leave requests table.
   ============================================================ */

const USER_DASHBOARD_API =
  `${window.PERSYS_CONFIG.API_BASE_URL}/api/user/dashboard.php`;

document.addEventListener("DOMContentLoaded", async () => {
  const authorized = await window.PERSYSUserGuard.ready;

  if (!authorized) {
    return;
  }

  loadDashboard();
});

async function loadDashboard() {
  const tableBody = document.getElementById("recentLeaveTableBody");

  try {
    let response;

    try {
      response = await fetch(USER_DASHBOARD_API, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });
    } catch (networkError) {
      window.PERSYSApiErrors.handleNetworkError(networkError);
      return;
    }

    const checkedResponse =
      await window.PERSYSApiErrors.handleResponse(response);

    if (!checkedResponse) {
      return;
    }

    const result = await checkedResponse.json();

    if (!result.success) {
      throw new Error(result.message || "Unable to load dashboard.");
    }

    const data = result.data;

    // ── Populate sidebar user info ──────────────────────────
    document.getElementById("userUsername").textContent =
      data.user.username;

    document.getElementById("userRole").textContent =
      data.user.role_name;

    // ── Welcome banner name ─────────────────────────────────
    const welcomeEl = document.getElementById("welcomeName");
    if (welcomeEl) welcomeEl.textContent = data.user.username;

    // ── Notification badge (pending count) ─────────────────
    const badgeEl = document.getElementById("notifBadge");
    if (badgeEl) badgeEl.textContent = data.stats.pending;

    // ── Populate stat cards — clear skeleton first ──────────
    ["pending","approved","rejected"].forEach(stat => {
      const el = document.querySelector(`[data-stat="${stat}"]`);
      if (el) el.innerHTML = "";
    });

    document.querySelector('[data-stat="pending"]').textContent =
      data.stats.pending;

    document.querySelector('[data-stat="approved"]').textContent =
      data.stats.approved;

    document.querySelector('[data-stat="rejected"]').textContent =
      data.stats.rejected;

    // ── Stat sub-labels ─────────────────────────────────────
    const pendingSub  = document.getElementById("pendingSub");
    const approvedSub = document.getElementById("approvedSub");
    const rejectedSub = document.getElementById("rejectedSub");

    if (pendingSub)  { pendingSub.innerHTML  = ""; pendingSub.textContent  =
      data.stats.pending  === 0 ? "No pending requests"  : `${data.stats.pending} pending`; }
    if (approvedSub) { approvedSub.innerHTML = ""; approvedSub.textContent =
      data.stats.approved === 0 ? "No approved requests" : `${data.stats.approved} approved`; }
    if (rejectedSub) { rejectedSub.innerHTML = ""; rejectedSub.textContent =
      data.stats.rejected === 0 ? "No rejected requests" : `${data.stats.rejected} rejected`; }

    // ── Populate service credit balances — clear skeleton ───
    const scLocalEl    = document.getElementById("scLocal");
    const scNationalEl = document.getElementById("scNational");
    if (scLocalEl)    { scLocalEl.innerHTML    = ""; scLocalEl.textContent    = formatCredits(data.service_credits.local); }
    if (scNationalEl) { scNationalEl.innerHTML = ""; scNationalEl.textContent = formatCredits(data.service_credits.national); }

    // ── Render recent leave requests table ──────────────────
    renderRecentLeaves(data.recent_leave_requests, tableBody);

  } catch (error) {
    console.error("User dashboard loading error:", error);

    if (tableBody) {
      tableBody.innerHTML =
        `<tr class="empty-row">
           <td colspan="5">Unable to load recent leave requests. Please refresh the page.</td>
         </tr>`;
    }
  }
}

/**
 * Format a credit balance to 2 decimal places.
 * @param {number} value
 * @returns {string}
 */
function formatCredits(value) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Render the recent leave requests into the table body.
 * @param {Array}       requests
 * @param {HTMLElement} tbody
 */
function renderRecentLeaves(requests, tbody) {
  tbody.replaceChildren();

  if (!requests || requests.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.innerHTML =
      `<div class="table-empty-state">
         <svg viewBox="0 0 24 24">
           <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5"/>
           <polyline points="14 2 14 8 20 8"/>
           <circle cx="16" cy="16" r="6"/>
           <polyline points="16 13 16 16 18 18"/>
         </svg>
         <p>No leave requests found.</p>
       </div>`;
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  // Status → CSS modifier map
  const STATUS_CLASS = {
    Approved: "status-badge--approved",
    Rejected: "status-badge--rejected",
    Pending:  "status-badge--pending"
  };

  requests.forEach((lr) => {
    const row = document.createElement("tr");

    // Leave Request #
    const tdNumber = document.createElement("td");
    tdNumber.textContent = lr.request_number;

    // Date Filed
    const tdDate = document.createElement("td");
    const parsedDate = new Date(String(lr.date_filed).replace(" ", "T"));
    tdDate.textContent = Number.isNaN(parsedDate.getTime())
      ? lr.date_filed
      : parsedDate.toLocaleDateString("en-US");

    // Total Days
    const tdDays = document.createElement("td");
    tdDays.textContent = lr.total_leave_days;

    // Status badge
    const tdStatus = document.createElement("td");
    const badge = document.createElement("span");
    badge.className =
      `status-badge ${STATUS_CLASS[lr.status] ?? "status-badge--pending"}`;
    badge.textContent = lr.status;
    tdStatus.appendChild(badge);

    // View link — TODO: update href once userRequest.html is migrated
    const tdView = document.createElement("td");
    const link = document.createElement("a");
    link.href = "userRequest.php";
    link.textContent = "View";
    tdView.appendChild(link);

    row.append(tdNumber, tdDate, tdDays, tdStatus, tdView);
    tbody.appendChild(row);
  });
}
