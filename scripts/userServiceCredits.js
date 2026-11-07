/* ============================================================
   PERSYS — User Service Credits
   Fetches /api/user/serviceCredits.php and renders:
     - Local and National balance cards
       (Current Balance, Overall Earned, Total Used)
     - Separate paginated history tables for Local and National
   ============================================================ */

const SC_API =
  `${window.PERSYS_CONFIG.API_BASE_URL}/api/user/serviceCredits.php`;

const ROWS_PER_PAGE = 10;

// Independent pagination state for each column.
let localTx      = [];
let nationalTx   = [];
let localPage    = 1;
let nationalPage = 1;

document.addEventListener("DOMContentLoaded", async () => {
  const authorized = await window.PERSYSUserGuard.ready;
  if (!authorized) return;
  loadServiceCredits();
});

/* ── Main loader ────────────────────────────────────────────── */

async function loadServiceCredits() {
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

    const data = result.data;

    // ── Sidebar ────────────────────────────────────────────
    document.getElementById("userUsername").textContent = data.user.username;
    document.getElementById("userRole").textContent     = data.user.role_name;

    // ── Split transactions by credit type ──────────────────
    const all = data.transactions || [];
    localTx    = all.filter(tx => tx.credit_type_name?.toUpperCase() === "LOCAL");
    nationalTx = all.filter(tx => tx.credit_type_name?.toUpperCase() === "NATIONAL");

    // ── Compute earned / used per type ─────────────────────
    const localEarned   = sumByType(localTx,    "EARNED");
    const localUsed     = sumByType(localTx,    "DEDUCTED");
    const natEarned     = sumByType(nationalTx, "EARNED");
    const natUsed       = sumByType(nationalTx, "DEDUCTED");

    // ── Balance cards — clear skeleton first ──────────────
    const clearSkel = (id, value) => {
      const el = document.getElementById(id);
      if (el) { el.innerHTML = ""; el.textContent = value; }
    };

    clearSkel("scLocalBalance",    formatCredits(data.total_local_credits));
    clearSkel("scLocalEarned",     formatCredits(localEarned));
    clearSkel("scLocalUsed",       formatCredits(localUsed));
    clearSkel("scNationalBalance", formatCredits(data.total_national_credits));
    clearSkel("scNationalEarned",  formatCredits(natEarned));
    clearSkel("scNationalUsed",    formatCredits(natUsed));

    // ── Render history tables ──────────────────────────────
    localPage    = 1;
    nationalPage = 1;

    renderPage(
      localPage, localTx,
      document.getElementById("scLocalBody"),
      document.getElementById("scLocalPagination"),
      "local"
    );

    renderPage(
      nationalPage, nationalTx,
      document.getElementById("scNationalBody"),
      document.getElementById("scNationalPagination"),
      "national"
    );

  } catch (error) {
    console.error("Service credits loading error:", error);

    ["scLocalBody", "scNationalBody"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML =
          `<tr class="empty-row">
             <td colspan="5">Unable to load. Please refresh.</td>
           </tr>`;
      }
    });
  }
}

/* ── Helpers ────────────────────────────────────────────────── */

function sumByType(rows, type) {
  return rows
    .filter(tx => tx.transaction_type === type)
    .reduce((sum, tx) => sum + Number(tx.credit_amount ?? 0), 0);
}

/* ── Page renderer ──────────────────────────────────────────── */

function renderPage(page, transactions, tbody, pagination, key) {
  const total      = transactions.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const clamped    = Math.min(Math.max(1, page), totalPages);

  if (key === "local")    localPage    = clamped;
  if (key === "national") nationalPage = clamped;

  const start = (clamped - 1) * ROWS_PER_PAGE;
  const slice = transactions.slice(start, start + ROWS_PER_PAGE);

  renderRows(slice, tbody, total);
  renderPagination(clamped, totalPages, pagination, transactions, tbody, key);
}

/* ── Table row renderer ─────────────────────────────────────── */

function renderRows(rows, tbody, totalCount) {
  tbody.replaceChildren();

  if (totalCount === 0) {
    const tr = document.createElement("tr");
    tr.className = "empty-row";
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "No transactions found.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(tx => {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = formatDate(tx.created_at);

    const tdType = document.createElement("td");
    tdType.textContent = tx.credit_type_name ?? "—";

    const tdActivity = document.createElement("td");
    tdActivity.textContent = tx.activity_name ?? "—";

    const tdStatus = document.createElement("td");
    const badge = document.createElement("span");
    const isEarned = tx.transaction_type === "EARNED";
    badge.className = `sc-badge ${isEarned ? "sc-badge--earned" : "sc-badge--deducted"}`;
    badge.textContent = tx.transaction_type ?? "—";
    tdStatus.appendChild(badge);

    const tdPoints = document.createElement("td");
    tdPoints.textContent = formatCredits(tx.credit_amount);

    tr.append(tdDate, tdType, tdActivity, tdStatus, tdPoints);
    tbody.appendChild(tr);
  });
}

/* ── Pagination renderer ────────────────────────────────────── */

function renderPagination(page, totalPages, container, transactions, tbody, key) {
  container.replaceChildren();

  if (totalPages <= 1) {
    container.hidden = true;
    return;
  }

  container.hidden = false;

  const total = transactions.length;
  const start = (page - 1) * ROWS_PER_PAGE + 1;
  const end   = Math.min(page * ROWS_PER_PAGE, total);

  const info = document.createElement("span");
  info.className   = "sc-pagination-info";
  info.textContent = `${start}–${end} of ${total}`;

  const group = document.createElement("div");
  group.className = "sc-pagination-btns";

  const prevBtn = makeBtn("← Prev", page <= 1, () => {
    renderPage(page - 1, transactions, tbody, container, key);
  });

  const pageNums = buildRange(page, totalPages);
  const pageButtons = pageNums.map(p => {
    if (p === "…") {
      const el = document.createElement("span");
      el.className = "sc-page-ellipsis";
      el.textContent = "…";
      return el;
    }
    return makeBtn(String(p), false, () => {
      renderPage(p, transactions, tbody, container, key);
    }, p === page);
  });

  const nextBtn = makeBtn("Next →", page >= totalPages, () => {
    renderPage(page + 1, transactions, tbody, container, key);
  });

  group.append(prevBtn, ...pageButtons, nextBtn);
  container.append(info, group);
}

function buildRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = [];
  const left  = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  pages.push(1);
  if (left > 2)          pages.push("…");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("…");
  pages.push(total);

  return pages;
}

function makeBtn(label, isDisabled, onClick, isActive = false) {
  const btn = document.createElement("button");
  btn.type        = "button";
  btn.textContent = label;
  btn.disabled    = isDisabled;
  btn.className   = "sc-page-btn" + (isActive ? " sc-page-btn--active" : "");
  if (!isDisabled) btn.addEventListener("click", onClick);
  return btn;
}

/* ── Formatting ─────────────────────────────────────────────── */

function formatCredits(value) {
  return Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", {
    month: "2-digit", day: "2-digit", year: "numeric"
  });
}
