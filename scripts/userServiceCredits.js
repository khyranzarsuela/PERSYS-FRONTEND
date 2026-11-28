/* ============================================================
   PERSYS — User Service Credits
   Fetches /api/user/serviceCredits.php and renders:
     - 3 Balance Cards: National, Wellness, and Local
       (Current Balance, Overall Earned, Total Used)
     - Unified filterable & paginated History table
       (Search, Credit Type filter, Status filter, 5/10/20 rows/page)
   ============================================================ */

const SC_API =
  `${window.PERSYS_CONFIG.API_BASE_URL}/api/user/serviceCredits.php`;

let allTransactions = [];
let filteredTransactions = [];
let currentPage = 1;
let rowsPerPage = 5;

document.addEventListener("DOMContentLoaded", async () => {
  const authorized = await window.PERSYSUserGuard.ready;
  if (!authorized) return;

  wireHistoryFilters();
  await loadServiceCredits();
});

function wireHistoryFilters() {
  const searchEl = document.getElementById("scHistorySearch");
  const typeEl = document.getElementById("scHistoryTypeFilter");
  const statusEl = document.getElementById("scHistoryStatusFilter");

  searchEl?.addEventListener("input", applyHistoryFilters);
  typeEl?.addEventListener("change", applyHistoryFilters);
  statusEl?.addEventListener("change", applyHistoryFilters);
}

async function loadServiceCredits() {
  const tbody = document.getElementById("scHistoryTableBody");

  try {
    let response;
    try {
      response = await fetch(SC_API, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
    } catch (networkError) {
      window.PERSYSApiErrors.handleNetworkError(networkError);
      return;
    }

    const checkedResponse =
      await window.PERSYSApiErrors.handleResponse(response);
    if (!checkedResponse) return;

    const result = await checkedResponse.json();
    if (!result.success) {
      throw new Error(result.message || "Unable to load service credits.");
    }

    const data = result.data || {};

    // Sidebar user info
    const userEl = document.getElementById("userUsername");
    const roleEl = document.getElementById("userRole");
    if (userEl && data.user?.username) userEl.textContent = data.user.username;
    if (roleEl && data.user?.role_name) roleEl.textContent = data.user.role_name;

    const isNonTeaching =
      String(data.user?.personnel_type || data.user?.role_name || "")
        .trim()
        .toLowerCase() === "non-teaching";

    allTransactions = Array.isArray(data.transactions) ? data.transactions : [];

    // Filter out any National rows if Non-Teaching (National is always 0 for Non-Teaching)
    if (isNonTeaching) {
      allTransactions = allTransactions.filter(
        tx =>
          String(tx.credit_type_name || "").toUpperCase() !== "NATIONAL" &&
          Number(tx.credit_type_id || 0) !== 2
      );
    }

    let natEarned = 0, natUsed = 0;
    let welEarned = 0, welUsed = 0;
    let locEarned = 0, locUsed = 0;

    allTransactions.forEach(tx => {
      const amt = Number(tx.credit_amount ?? 0) || 0;
      const isEarned = String(tx.transaction_type || "").toUpperCase() === "EARNED";
      const cName = String(tx.credit_type_name || "").toUpperCase();
      const cId = Number(tx.credit_type_id || 0);

      if (cName === "NATIONAL" || cId === 2) {
        if (isEarned) natEarned += amt;
        else natUsed += amt;
      } else if (cName === "WELLNESS" || cId === 3) {
        if (isEarned) welEarned += amt;
        else welUsed += amt;
      } else if (cName === "LOCAL" || cId === 1) {
        if (isEarned) locEarned += amt;
        else locUsed += amt;
      }
    });

    const setCardVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = formatCredits(val);
    };

    // Non-Teaching personnel always have 0.00 National balance, earned, and used
    if (isNonTeaching) {
      setCardVal("scNationalBalance", 0);
      setCardVal("scNationalEarned", 0);
      setCardVal("scNationalUsed", 0);
    } else {
      setCardVal("scNationalBalance", data.total_national_credits ?? (natEarned - natUsed));
      setCardVal("scNationalEarned", natEarned);
      setCardVal("scNationalUsed", natUsed);
    }

    setCardVal("scWellnessBalance", data.total_wellness_credits ?? (welEarned - welUsed));
    setCardVal("scWellnessEarned", welEarned);
    setCardVal("scWellnessUsed", welUsed);

    setCardVal("scLocalBalance", data.total_local_credits ?? (locEarned - locUsed));
    setCardVal("scLocalEarned", locEarned);
    setCardVal("scLocalUsed", locUsed);

    applyHistoryFilters();
  } catch (error) {
    console.error("Service credits loading error:", error);
    if (tbody) {
      tbody.innerHTML =
        `<tr><td colspan="5" style="text-align:center;padding:24px;color:#9ca3af;font-style:italic;">
           Unable to load service credit history. Please refresh.
         </td></tr>`;
    }
  }
}

function applyHistoryFilters() {
  const q = (document.getElementById("scHistorySearch")?.value ?? "").trim().toLowerCase();
  const typeVal = (document.getElementById("scHistoryTypeFilter")?.value ?? "all").toLowerCase();
  const statusVal = (document.getElementById("scHistoryStatusFilter")?.value ?? "all").toLowerCase();

  filteredTransactions = allTransactions.filter(tx => {
    const cType = String(tx.credit_type_name || "").toLowerCase();
    const st = String(tx.transaction_type || "").toLowerCase();
    const act = String(tx.activity_name || "").toLowerCase();
    const dt = formatDate(tx.activity_start_date || tx.created_at).toLowerCase();

    if (typeVal !== "all" && cType !== typeVal) return false;
    if (statusVal !== "all" && st !== statusVal) return false;
    if (q && !act.includes(q) && !cType.includes(q) && !dt.includes(q) && !st.includes(q)) {
      return false;
    }
    return true;
  });

  currentPage = 1;
  renderHistoryPage();
}

function renderHistoryPage() {
  const tbody = document.getElementById("scHistoryTableBody");
  const pagEl = document.getElementById("scHistoryPagination");
  if (!tbody) return;

  tbody.replaceChildren();
  const total = filteredTransactions.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);

  if (total === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.style.cssText = "text-align:center;padding:28px;color:#9ca3af;font-style:italic;";
    td.textContent = allTransactions.length > 0
      ? "No service credit records match your filter."
      : "No service credit transactions found.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    if (pagEl) pagEl.hidden = true;
    return;
  }

  const start = (currentPage - 1) * rowsPerPage;
  const slice = filteredTransactions.slice(start, start + rowsPerPage);

  slice.forEach(tx => {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = formatDate(tx.activity_start_date || tx.created_at);

    const tdType = document.createElement("td");
    tdType.textContent = tx.credit_type_name ?? "—";

    const tdAct = document.createElement("td");
    tdAct.textContent = tx.activity_name ?? "—";

    const tdStatus = document.createElement("td");
    const isEarned = String(tx.transaction_type || "").toUpperCase() === "EARNED";
    const badge = document.createElement("span");
    badge.className = `sc-badge ${isEarned ? "sc-badge--earned" : "sc-badge--deducted"}`;
    badge.textContent = isEarned ? "EARNED" : "DEDUCTED";
    tdStatus.appendChild(badge);

    const tdCredits = document.createElement("td");
    tdCredits.style.textAlign = "right";
    tdCredits.style.fontWeight = "700";
    tdCredits.textContent = formatCredits(tx.credit_amount);

    tr.append(tdDate, tdType, tdAct, tdStatus, tdCredits);
    tbody.appendChild(tr);
  });

  renderHistoryPagination(currentPage, totalPages, total, pagEl);
}

function renderHistoryPagination(page, totalPages, total, container) {
  if (!container) return;
  container.replaceChildren();

  if (total === 0) {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  const start = (page - 1) * rowsPerPage + 1;
  const end = Math.min(page * rowsPerPage, total);

  const info = document.createElement("span");
  info.className = "u-sc-pag-info";
  info.textContent = `Showing ${start}–${end} of ${total} records`;

  const controls = document.createElement("div");
  controls.className = "u-sc-pag-controls";

  const sizeLabel = document.createElement("label");
  sizeLabel.textContent = "Rows per page: ";
  const sizeSelect = document.createElement("select");
  sizeSelect.className = "u-sc-pag-select";
  [5, 10, 20].forEach(n => {
    const opt = document.createElement("option");
    opt.value = String(n);
    opt.textContent = String(n);
    if (n === rowsPerPage) opt.selected = true;
    sizeSelect.appendChild(opt);
  });
  sizeSelect.addEventListener("change", () => {
    rowsPerPage = Number(sizeSelect.value) || 5;
    currentPage = 1;
    renderHistoryPage();
  });
  sizeLabel.appendChild(sizeSelect);
  controls.appendChild(sizeLabel);

  controls.appendChild(
    makeBtn("‹", page <= 1, () => {
      currentPage = page - 1;
      renderHistoryPage();
    })
  );

  for (const p of buildRange(page, totalPages)) {
    if (p === "…") {
      const span = document.createElement("span");
      span.style.padding = "0 4px";
      span.style.color = "#9ca3af";
      span.textContent = "…";
      controls.appendChild(span);
    } else {
      controls.appendChild(
        makeBtn(
          String(p),
          false,
          () => {
            currentPage = p;
            renderHistoryPage();
          },
          p === page
        )
      );
    }
  }

  controls.appendChild(
    makeBtn("›", page >= totalPages, () => {
      currentPage = page + 1;
      renderHistoryPage();
    })
  );

  container.append(info, controls);
}

function buildRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  pages.push(1);
  if (left > 2) pages.push("…");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

function makeBtn(label, isDisabled, onClick, isActive = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.disabled = isDisabled;
  btn.className = "sc-page-btn" + (isActive ? " sc-page-btn--active" : "");
  if (!isDisabled) btn.addEventListener("click", onClick);
  return btn;
}

function formatCredits(value) {
  return Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(value) {
  if (!value) return "—";
  const ymd = String(value).trim().slice(0, 10);
  const parts = ymd.split("-");
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}/${parts[0]}`;
  }
  const d = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });
}
