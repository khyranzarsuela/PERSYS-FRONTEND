/* ============================================================
   PERSYS — Reusable Global Read-Only Calendar Component
   Mounts on:
     - Admin Dashboard (#calendarHolidaysCard)
     - Principal Dashboard (#principalGlobalCalendarCard)
     - User / Teacher Dashboard (#userGlobalCalendarCard)
   Strictly View-Only: no event creation, editing, dragging, or deleting.
   ============================================================ */

(function () {
  "use strict";

  const CALENDAR_API_URL =
    `${window.PERSYS_CONFIG?.API_BASE_URL || ""}/api/calendar/events.php`;

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let sharedModalWired = false;

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toYMD(year, monthIndex0, day) {
    return `${year}-${pad2(monthIndex0 + 1)}-${pad2(day)}`;
  }

  function formatDisplayDate(ymd) {
    if (!ymd) return "—";
    const parts = String(ymd).slice(0, 10).split("-");
    if (parts.length !== 3) return ymd;
    const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(dt.getTime())) return ymd;
    return dt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function ensureDetailModal() {
    let overlay = document.getElementById("persysGcalDetailModalOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "persys-gcal-modal-overlay";
    overlay.id = "persysGcalDetailModalOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "persysGcalModalTitle");

    overlay.innerHTML = `
      <div class="persys-gcal-modal">
        <button type="button" class="persys-gcal-modal-close" id="persysGcalModalCloseX" aria-label="Close">&#10005;</button>
        <span class="persys-gcal-modal-badge badge-leave" id="persysGcalModalBadge">Approved Leave</span>
        <h3 class="persys-gcal-modal-title" id="persysGcalModalTitle">—</h3>

        <div class="persys-gcal-modal-row">
          <span class="persys-gcal-modal-lbl">Event Type</span>
          <span class="persys-gcal-modal-val" id="persysGcalModalType">—</span>
        </div>
        <div class="persys-gcal-modal-row">
          <span class="persys-gcal-modal-lbl">Inclusive Date(s)</span>
          <span class="persys-gcal-modal-val" id="persysGcalModalDates">—</span>
        </div>
        <div class="persys-gcal-modal-row">
          <span class="persys-gcal-modal-lbl">Calendar Source</span>
          <span class="persys-gcal-modal-val" id="persysGcalModalSource">—</span>
        </div>

        <div class="persys-gcal-privacy-note">
          Global Read-Only Schedule. Private leave reasons, medical notes, and individual service credit balances are protected and never displayed on the global calendar.
        </div>

        <div class="persys-gcal-modal-footer">
          <button type="button" class="persys-gcal-modal-btn" id="persysGcalModalCloseBtn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    if (!sharedModalWired) {
      sharedModalWired = true;
      const closeModal = () => {
        overlay.classList.remove("is-open");
      };
      overlay.querySelector("#persysGcalModalCloseX")?.addEventListener("click", closeModal);
      overlay.querySelector("#persysGcalModalCloseBtn")?.addEventListener("click", closeModal);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.classList.contains("is-open")) {
          closeModal();
        }
      });
    }

    return overlay;
  }

  function openEventDetailModal(ev, source) {
    const overlay = ensureDetailModal();
    const isCredit = ev.type === "service_credit_upload";

    const badgeEl = document.getElementById("persysGcalModalBadge");
    if (badgeEl) {
      badgeEl.className = `persys-gcal-modal-badge ${isCredit ? "badge-credit" : "badge-leave"}`;
      badgeEl.textContent = isCredit ? "Service Credit Upload" : "Approved Leave";
    }

    const titleEl = document.getElementById("persysGcalModalTitle");
    if (titleEl) titleEl.textContent = ev.title || "Schedule Event";

    const typeEl = document.getElementById("persysGcalModalType");
    if (typeEl) {
      typeEl.textContent = isCredit
        ? `Batch Upload (${ev.details?.employee_count || 1} Employee(s))`
        : (ev.details?.leave_type_name || "Approved Leave Request");
    }

    const datesEl = document.getElementById("persysGcalModalDates");
    if (datesEl) {
      const sFmt = formatDisplayDate(ev.start);
      const eFmt = formatDisplayDate(ev.end || ev.start);
      datesEl.textContent = sFmt === eFmt ? sFmt : `${sFmt} – ${eFmt}`;
    }

    const srcEl = document.getElementById("persysGcalModalSource");
    if (srcEl) {
      srcEl.textContent = source === "google_calendar"
        ? "Google Calendar API (Synced)"
        : "Offline Mode — Local PERSYS Schedule";
    }

    overlay.classList.add("is-open");
  }

  /**
   * Mount a read-only calendar instance inside `containerOrId`.
   *
   * @param {HTMLElement|string} containerOrId
   * @param {{ large?: boolean, maxVisiblePerDay?: number }} options
   */
  function mountGlobalCalendar(containerOrId, options = {}) {
    const container = typeof containerOrId === "string"
      ? document.getElementById(containerOrId)
      : containerOrId;

    if (!container) return null;

    const isLarge = Boolean(options.large || container.classList.contains("persys-calendar-large"));
    const maxVisible = options.maxVisiblePerDay || (isLarge ? 4 : 2);

    const now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth(); // 0-11
    let currentSource = "local_fallback";
    let currentEvents = [];

    container.innerHTML = `
      <div class="persys-gcal-wrapper">
        <div class="persys-gcal-header">
          <div class="persys-gcal-title-group">
            <div class="persys-gcal-title-row">
              <h2 class="persys-gcal-title">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Global Schedule Calendar
              </h2>
              <span class="persys-gcal-readonly-tag">View-Only</span>
            </div>
            <p class="persys-gcal-subtitle" data-gcal-subtitle>
              School-wide Approved Leaves &amp; Service Credit Upload Dates
            </p>
          </div>

          <span class="persys-gcal-source-badge is-online" data-gcal-source-badge>
            <span class="persys-gcal-source-dot" aria-hidden="true"></span>
            <span data-gcal-source-text>Loading Calendar...</span>
          </span>
        </div>

        <div class="persys-gcal-toolbar">
          <div class="persys-gcal-nav">
            <button type="button" class="persys-gcal-nav-btn" data-gcal-prev aria-label="Previous month">&#8249; Prev</button>
            <span class="persys-gcal-month-label" data-gcal-month-label>—</span>
            <button type="button" class="persys-gcal-nav-btn" data-gcal-next aria-label="Next month">Next &#8250;</button>
            <button type="button" class="persys-gcal-nav-btn" data-gcal-today>Today</button>
          </div>

          <div class="persys-gcal-legend" aria-label="Calendar event legend">
            <span class="persys-gcal-legend-item">
              <span class="persys-gcal-legend-swatch swatch-leave" aria-hidden="true"></span>
              <span data-gcal-leave-legend>Approved Leave</span>
            </span>
            <span class="persys-gcal-legend-item">
              <span class="persys-gcal-legend-swatch swatch-credit" aria-hidden="true"></span>
              Service Credits Uploaded
            </span>
          </div>
        </div>

        <div class="persys-gcal-grid-wrap">
          <div class="persys-gcal-weekdays" role="row">
            ${WEEKDAYS.map((d) => `<div class="persys-gcal-weekday" role="columnheader">${d}</div>`).join("")}
          </div>
          <div class="persys-gcal-grid" data-gcal-grid role="grid" aria-label="Monthly schedule grid"></div>
        </div>
      </div>
    `;

    const monthLabelEl  = container.querySelector("[data-gcal-month-label]");
    const gridEl        = container.querySelector("[data-gcal-grid]");
    const sourceBadgeEl = container.querySelector("[data-gcal-source-badge]");
    const sourceTextEl  = container.querySelector("[data-gcal-source-text]");
    const prevBtn       = container.querySelector("[data-gcal-prev]");
    const nextBtn       = container.querySelector("[data-gcal-next]");
    const todayBtn      = container.querySelector("[data-gcal-today]");

    prevBtn?.addEventListener("click", () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      fetchAndRenderMonth();
    });

    nextBtn?.addEventListener("click", () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      fetchAndRenderMonth();
    });

    todayBtn?.addEventListener("click", () => {
      const today = new Date();
      currentYear = today.getFullYear();
      currentMonth = today.getMonth();
      fetchAndRenderMonth();
    });

    function computeGridRange(year, month0) {
      const firstOfMonth = new Date(year, month0, 1);
      const startDow = firstOfMonth.getDay(); // 0..6
      const gridStart = new Date(year, month0, 1 - startDow);

      const lastOfMonth = new Date(year, month0 + 1, 0);
      const endDow = lastOfMonth.getDay();
      const gridEnd = new Date(year, month0 + 1, 6 - endDow);

      const startYmd = toYMD(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate());
      const endYmd   = toYMD(gridEnd.getFullYear(), gridEnd.getMonth(), gridEnd.getDate());

      return { gridStart, gridEnd, startYmd, endYmd };
    }

    async function fetchAndRenderMonth() {
      if (monthLabelEl) {
        monthLabelEl.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
      }

      const { gridStart, gridEnd, startYmd, endYmd } = computeGridRange(currentYear, currentMonth);

      try {
        const url = `${CALENDAR_API_URL}?start=${encodeURIComponent(startYmd)}&end=${encodeURIComponent(endYmd)}`;
        const res = await fetch(url, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" }
        });

        const result = await res.json().catch(() => null);
        if (res.ok && result && result.success && result.data) {
          currentSource = result.data.source || "local_fallback";
          currentEvents = Array.isArray(result.data.events) ? result.data.events : [];

          const isPersonalScope = result.data.scope === "personal_leaves";
          const subtitleEl = container.querySelector("[data-gcal-subtitle]");
          const leaveLegendEl = container.querySelector("[data-gcal-leave-legend]");
          if (subtitleEl) {
            subtitleEl.textContent = isPersonalScope
              ? "My Approved Leaves & School Service Credit Upload Dates"
              : "School-wide Approved Leaves & Service Credit Upload Dates";
          }
          if (leaveLegendEl) {
            leaveLegendEl.textContent = isPersonalScope
              ? "My Approved Leave"
              : "Approved Leave";
          }
        } else {
          currentSource = "local_fallback";
        }
      } catch (err) {
        console.warn("Global calendar fetch fell back to local state:", err);
        currentSource = "local_fallback";
      }

      updateSourceBadge(currentSource);
      renderGridCells(gridStart, gridEnd);
    }

    function updateSourceBadge(source) {
      if (!sourceBadgeEl || !sourceTextEl) return;
      if (source === "google_calendar") {
        sourceBadgeEl.className = "persys-gcal-source-badge is-online";
        sourceTextEl.textContent = "Google Calendar Live";
      } else {
        sourceBadgeEl.className = "persys-gcal-source-badge is-fallback";
        sourceTextEl.textContent = "Offline Mode — Showing Local Schedule";
      }
    }

    function getEventsForDay(dayYmd) {
      return currentEvents.filter((ev) => {
        const s = String(ev.start || "").slice(0, 10);
        const e = String(ev.end || ev.start || "").slice(0, 10);
        return s <= dayYmd && e >= dayYmd;
      });
    }

    function renderGridCells(gridStart, gridEnd) {
      if (!gridEl) return;
      gridEl.replaceChildren();

      const todayNow = new Date();
      const todayYmd = toYMD(todayNow.getFullYear(), todayNow.getMonth(), todayNow.getDate());

      const cursor = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate());
      let safety = 0;

      while (cursor <= gridEnd && safety < 49) {
        safety++;
        const cellYear  = cursor.getFullYear();
        const cellMonth = cursor.getMonth();
        const cellDate  = cursor.getDate();
        const cellYmd   = toYMD(cellYear, cellMonth, cellDate);

        const isOutside = cellMonth !== currentMonth;
        const isToday   = cellYmd === todayYmd;

        const cell = document.createElement("div");
        cell.className = "persys-gcal-cell"
          + (isOutside ? " is-outside-month" : "")
          + (isToday ? " is-today" : "");
        cell.setAttribute("role", "gridcell");

        const header = document.createElement("div");
        header.className = "persys-gcal-day-header";

        const numSpan = document.createElement("span");
        numSpan.className = "persys-gcal-day-num";
        numSpan.textContent = String(cellDate);
        header.appendChild(numSpan);
        cell.appendChild(header);

        const dayEvents = getEventsForDay(cellYmd);
        if (dayEvents.length > 0) {
          const list = document.createElement("div");
          list.className = "persys-gcal-events-list";

          const visibleSlice = dayEvents.slice(0, maxVisible);
          visibleSlice.forEach((ev) => {
            const btn = document.createElement("button");
            btn.type = "button";
            const isCredit = ev.type === "service_credit_upload";
            btn.className = `persys-gcal-event-pill ${isCredit ? "event-service-credit" : "event-leave"}`;
            btn.textContent = ev.title || "Event";
            btn.title = `${ev.title} (${formatDisplayDate(ev.start)}${ev.end && ev.end !== ev.start ? " - " + formatDisplayDate(ev.end) : ""})`;
            btn.addEventListener("click", () => openEventDetailModal(ev, currentSource));
            list.appendChild(btn);
          });

          if (dayEvents.length > maxVisible) {
            const moreBtn = document.createElement("button");
            moreBtn.type = "button";
            moreBtn.className = "persys-gcal-more-btn";
            moreBtn.textContent = `+${dayEvents.length - maxVisible} more`;
            moreBtn.addEventListener("click", () => {
              openEventDetailModal(dayEvents[maxVisible], currentSource);
            });
            list.appendChild(moreBtn);
          }

          cell.appendChild(list);
        }

        gridEl.appendChild(cell);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    fetchAndRenderMonth();

    return {
      refresh: fetchAndRenderMonth
    };
  }

  window.PERSYSGlobalCalendar = {
    mount: mountGlobalCalendar
  };
})();
