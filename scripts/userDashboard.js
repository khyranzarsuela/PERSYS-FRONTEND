/* ============================================================
   PERSYS — User Dashboard
   - Populates stat cards, service credit balances, and recent leaves
   - Quick Action: Request Edit Profile modal + My Edit Requests history
   ============================================================ */

const USER_DASHBOARD_API =
  `${window.PERSYS_CONFIG.API_BASE_URL}/api/user/dashboard.php`;
const USER_PROFILE_EDIT_REQ_API =
  `${window.PERSYS_CONFIG.API_BASE_URL}/api/user/profileEditRequests.php`;

document.addEventListener("DOMContentLoaded", async () => {
  const authorized = await window.PERSYSUserGuard.ready;
  if (!authorized) {
    return;
  }

  wireRequestEditProfileModal();
  await loadDashboard();
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

    document.getElementById("userUsername").textContent =
      data.user.username;
    document.getElementById("userRole").textContent =
      data.user.role_name;

    const welcomeEl = document.getElementById("welcomeName");
    if (welcomeEl) welcomeEl.textContent = data.user.username;

    const badgeEl = document.getElementById("notifBadge");
    if (badgeEl) badgeEl.textContent = data.stats.pending;

    ["pending", "approved", "rejected"].forEach((stat) => {
      const el = document.querySelector(`[data-stat="${stat}"]`);
      if (el) el.innerHTML = "";
    });

    document.querySelector('[data-stat="pending"]').textContent =
      data.stats.pending;
    document.querySelector('[data-stat="approved"]').textContent =
      data.stats.approved;
    document.querySelector('[data-stat="rejected"]').textContent =
      data.stats.rejected;

    const pendingSub = document.getElementById("pendingSub");
    const approvedSub = document.getElementById("approvedSub");
    const rejectedSub = document.getElementById("rejectedSub");

    if (pendingSub) {
      pendingSub.innerHTML = "";
      pendingSub.textContent =
        data.stats.pending === 0
          ? "No pending requests"
          : `${data.stats.pending} pending`;
    }
    if (approvedSub) {
      approvedSub.innerHTML = "";
      approvedSub.textContent =
        data.stats.approved === 0
          ? "No approved requests"
          : `${data.stats.approved} approved`;
    }
    if (rejectedSub) {
      rejectedSub.innerHTML = "";
      rejectedSub.textContent =
        data.stats.rejected === 0
          ? "No rejected requests"
          : `${data.stats.rejected} rejected`;
    }

    const scLocalEl = document.getElementById("scLocal");
    const scNationalEl = document.getElementById("scNational");
    if (scLocalEl) {
      scLocalEl.innerHTML = "";
      scLocalEl.textContent = formatCredits(data.service_credits.local);
    }
    if (scNationalEl) {
      scNationalEl.innerHTML = "";
      scNationalEl.textContent = formatCredits(data.service_credits.national);
    }

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

function formatCredits(value) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

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

  const STATUS_CLASS = {
    Approved: "status-badge--approved",
    Rejected: "status-badge--rejected",
    Pending: "status-badge--pending"
  };

  requests.forEach((lr) => {
    const row = document.createElement("tr");

    const tdNumber = document.createElement("td");
    tdNumber.textContent = lr.request_number;

    const tdDate = document.createElement("td");
    const parsedDate = new Date(String(lr.date_filed).replace(" ", "T"));
    tdDate.textContent = Number.isNaN(parsedDate.getTime())
      ? lr.date_filed
      : parsedDate.toLocaleDateString("en-US");

    const tdDays = document.createElement("td");
    tdDays.textContent = lr.total_leave_days;

    const tdStatus = document.createElement("td");
    const badge = document.createElement("span");
    badge.className =
      `status-badge ${STATUS_CLASS[lr.status] ?? "status-badge--pending"}`;
    badge.textContent = lr.status;
    tdStatus.appendChild(badge);

    const tdView = document.createElement("td");
    const link = document.createElement("a");
    link.href = "userRequest.html";
    link.textContent = "View";
    tdView.appendChild(link);

    row.append(tdNumber, tdDate, tdDays, tdStatus, tdView);
    tbody.appendChild(row);
  });
}

/* ═══════════════════════════════════════════════════════════════
   REQUEST EDIT PROFILE MODAL & MY REQUESTS HISTORY
═══════════════════════════════════════════════════════════════ */

function wireRequestEditProfileModal() {
  const openBtn = document.getElementById("btnQuickRequestEditProfile");
  const overlay = document.getElementById("requestEditProfileModalOverlay");
  const closeXBtn = document.getElementById("btnCloseRequestEditProfileX");
  const cancelBtn = document.getElementById("btnCancelRequestEditProfile");
  const form = document.getElementById("requestEditProfileForm");
  const categoryEl = document.getElementById("editReqCategory");
  const messageEl = document.getElementById("editReqMessage");
  const charCountEl = document.getElementById("editReqCharCount");
  const submitBtn = document.getElementById("btnSubmitRequestEditProfile");
  const noticeEl = document.getElementById("requestEditProfileNotice");

  function showNotice(type, text) {
    if (!noticeEl) return;
    noticeEl.textContent = text;
    noticeEl.className = `edit-req-notice ${
      type === "success" ? "is-success" : "is-error"
    }`;
    noticeEl.hidden = false;
  }

  function clearNotice() {
    if (!noticeEl) return;
    noticeEl.textContent = "";
    noticeEl.hidden = true;
  }

  function updateCharCount() {
    if (!messageEl || !charCountEl) return;
    const len = messageEl.value.length;
    charCountEl.textContent = `${len} / 1000`;
  }

  function openModal() {
    if (!overlay) return;
    clearNotice();
    form?.reset();
    updateCharCount();
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    messageEl?.focus();
    loadMyProfileEditRequests();
  }

  function closeModal() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.style.overflow = "";
  }

  openBtn?.addEventListener("click", openModal);
  closeXBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  messageEl?.addEventListener("input", updateCharCount);

  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay && !overlay.hidden) {
      closeModal();
    }
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearNotice();

    const category = (categoryEl?.value ?? "Personal Information").trim();
    const message = (messageEl?.value ?? "").trim();

    if (message.length < 5) {
      showNotice(
        "error",
        "Please enter at least 5 characters describing the changes needed."
      );
      messageEl?.focus();
      return;
    }

    if (message.length > 1000) {
      showNotice("error", "Request message must not exceed 1,000 characters.");
      messageEl?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
    }

    try {
      let response;
      try {
        response = await fetch(USER_PROFILE_EDIT_REQ_API, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({
            category,
            message
          })
        });
      } catch (networkErr) {
        window.PERSYSApiErrors.handleNetworkError(networkErr);
        return;
      }

      const checked =
        await window.PERSYSApiErrors.handleResponse(response);
      if (!checked) return;

      const result = await checked.json();
      if (!response.ok || !result.success) {
        showNotice(
          "error",
          result.message || "Unable to submit profile edit request."
        );
        return;
      }

      if (messageEl) messageEl.value = "";
      updateCharCount();
      showNotice(
        "success",
        result.message ||
          "Your profile edit request has been sent to the administrator."
      );
      await loadMyProfileEditRequests();
    } catch (err) {
      console.error("Submit profile edit request error:", err);
      showNotice(
        "error",
        "An unexpected error occurred while submitting your request."
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Request";
      }
    }
  });
}

async function loadMyProfileEditRequests() {
  const listEl = document.getElementById("myEditRequestsList");
  if (!listEl) return;

  try {
    const response = await fetch(USER_PROFILE_EDIT_REQ_API, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error("Unable to load your submitted requests.");
    }

    const result = await response.json();
    const requests = Array.isArray(result?.data?.requests)
      ? result.data.requests
      : [];

    listEl.replaceChildren();

    if (requests.length === 0) {
      const emptyP = document.createElement("p");
      emptyP.style.cssText =
        "font-size:0.825rem; color:#9ca3af; font-style:italic; margin:0;";
      emptyP.textContent = "You have not submitted any profile edit requests yet.";
      listEl.appendChild(emptyP);
      return;
    }

    requests.forEach((req) => {
      const card = document.createElement("div");
      card.className = "my-edit-req-card";

      const top = document.createElement("div");
      top.className = "my-edit-req-top";

      const idCat = document.createElement("span");
      idCat.className = "my-edit-req-id-cat";
      idCat.textContent = `${req.request_id || "REQ"} • ${
        req.category || "Profile"
      }`;

      const rawStatus = String(req.status || "PENDING").toUpperCase();
      const badge = document.createElement("span");
      badge.className =
        "my-edit-req-badge " +
        (rawStatus === "RESOLVED"
          ? "is-resolved"
          : rawStatus === "DECLINED"
          ? "is-declined"
          : "is-pending");
      badge.textContent = rawStatus;

      top.append(idCat, badge);

      const msg = document.createElement("p");
      msg.className = "my-edit-req-msg";
      msg.textContent = req.message || "";

      const dateSpan = document.createElement("span");
      dateSpan.className = "my-edit-req-date";
      const createdFmt = formatIsoDateTime(req.created_at);
      dateSpan.textContent = req.resolved_at
        ? `Submitted: ${createdFmt} • Reviewed: ${formatIsoDateTime(
            req.resolved_at
          )}${req.resolved_by ? ` by ${req.resolved_by}` : ""}`
        : `Submitted: ${createdFmt}`;

      card.append(top, msg);

      if (req.admin_note) {
        const note = document.createElement("div");
        note.className = "my-edit-req-note";
        note.textContent = `Admin Note: ${req.admin_note}`;
        card.appendChild(note);
      }

      card.appendChild(dateSpan);
      listEl.appendChild(card);
    });
  } catch (err) {
    console.error("Load my edit requests error:", err);
    listEl.replaceChildren();
    const errP = document.createElement("p");
    errP.style.cssText =
      "font-size:0.825rem; color:#dc2626; font-style:italic; margin:0;";
    errP.textContent = "Unable to load your submitted requests.";
    listEl.appendChild(errP);
  }
}

function formatIsoDateTime(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
