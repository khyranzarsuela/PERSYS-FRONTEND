const DASHBOARD_API =
  `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/dashboard.php`;

document.addEventListener("DOMContentLoaded", async () => {
  const authorized = await window.PERSYSAdminGuard.ready;

  if (!authorized) {
    return;
  }

  loadDashboard();
});

async function loadDashboard() {
  const notificationList = document.getElementById("recentLeaveRequests");

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
      // if (response.status === 401) {
      //   window.location.href = "../../index.html";
      //   return;
      // }

      throw new Error(result.message || "Unable to load dashboard.");
    }

    const data = result.data;

    document.getElementById("adminUsername").textContent =
      data.admin.username;

    document.getElementById("adminRole").textContent =
      data.admin.role_name;

    document.querySelector('[data-stat="active-teaching"]').textContent =
      data.statistics.active_teaching;

    document.querySelector('[data-stat="active-nonteaching"]').textContent =
      data.statistics.active_non_teaching;

    document.querySelector('[data-stat="pending-leave"]').textContent =
      data.statistics.pending_leave;

    renderRecentRequests(data.recent_leave_requests, notificationList);

  } catch (error) {
    console.error("Dashboard loading error:", error);

    notificationList.replaceChildren();

    const message = document.createElement("p");
    message.style.cssText = "text-align:center; padding:8px 0;";
    message.textContent =
      "Unable to load dashboard data. Please refresh the page.";

    notificationList.appendChild(message);
  }
}

function renderRecentRequests(requests, list) {
  list.replaceChildren();

  if (!requests || requests.length === 0) {
    const item = document.createElement("li");
    item.className = "notif-item";

    const message = document.createElement("p");
    message.style.cssText = "text-align:center; padding:8px 0;";
    message.textContent = "No pending leave requests.";

    item.appendChild(message);
    list.appendChild(item);
    return;
  }

  requests.forEach((request) => {
    const item = document.createElement("li");
    item.className = "notif-item";

    const top = document.createElement("div");
    top.className = "notif-item-top";

    const requestId = document.createElement("span");
    requestId.className = "notif-request-id";
    requestId.textContent = `Leave Request #${request.request_number}`;

    const status = document.createElement("span");
    status.className = "badge-pending";
    status.textContent = request.status;

    top.append(requestId, status);

    const meta = document.createElement("div");
    meta.className = "notif-meta";

    const person = document.createElement("p");
    const personName = document.createElement("span");
    personName.textContent =
      `From: ${request.first_name} ${request.last_name}`;

    const personnelType = document.createElement("strong");
    personnelType.textContent = ` (${request.personnel_type})`;

    person.append(personName, personnelType);

    const metaRow = document.createElement("div");
    metaRow.className = "notif-meta-row";

    const leaveType = document.createElement("span");
    leaveType.textContent = `Type: ${request.leave_type_name}`;

    const date = document.createElement("span");
    const parsedDate = new Date(
      String(request.start_datetime).replace(" ", "T")
    );

    date.textContent = Number.isNaN(parsedDate.getTime())
      ? `Date: ${request.start_datetime}`
      : `Date: ${parsedDate.toLocaleDateString("en-US")}`;

    metaRow.append(leaveType, date);
    meta.append(person, metaRow);

    const link = document.createElement("a");
    link.className = "notif-link";
    link.href =
      `adminTransactions.php?request_id=${encodeURIComponent(
        request.leave_request_id
      )}`;

    link.textContent = "Click to view details & process →";

    item.append(top, meta, link);
    list.appendChild(item);
  });
}
