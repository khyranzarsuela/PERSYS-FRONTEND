/* ============================================================
   PERSYS — Shared Admin Authentication Guard
   ------------------------------------------------------------
   Admin pages require the ADMIN VIEW (not just the admin role).

   - Not logged in                     → login page
   - Admin currently in user view      → their user dashboard
   - Regular user (never allowed)      → 403 error page
   ============================================================ */

(function () {
  "use strict";

  const API_URL =
    `${window.PERSYS_CONFIG.API_BASE_URL}/api/auth/me.php`;

  const BASE = window.PERSYS_CONFIG.FRONTEND_BASE_URL;
  const LOGIN_URL = `${BASE}/index.html`;
  const ERROR_URL = `${BASE}/error.html`;
  const USER_DASHBOARD_URL = `${BASE}/Pages/Users/userDashboard.html`;

  // Hide protected page content while the session is checked.
  document.documentElement.style.visibility = "hidden";

  let sessionData = null;

  async function verifyAdminSession() {
    try {
      const response = await fetch(API_URL, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" }
      });

      if (response.status === 401) {
        window.location.replace(LOGIN_URL);
        return false;
      }

      if (response.status === 403) {
        window.location.replace(ERROR_URL + "?code=403");
        return false;
      }

      if (!response.ok) {
        window.location.replace(ERROR_URL + "?code=500");
        return false;
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        window.location.replace(ERROR_URL + "?code=500");
        return false;
      }

      const data = result.data;
      const isAdmin = Number(data.role_id) === 1;
      // Older backends have no active_view: treat admins as admin view.
      const activeView = data.active_view || (isAdmin ? "admin" : "user");

      if (activeView !== "admin") {
        // An admin who switched to user view goes back to their user side.
        window.location.replace(
          isAdmin ? USER_DASHBOARD_URL : ERROR_URL + "?code=403"
        );
        return false;
      }

      sessionData = data;
      applyPrincipalGlobalRules(data);
      document.documentElement.style.visibility = "visible";
      return true;

    } catch (error) {
      console.error("Admin session verification failed:", error);
      window.location.replace(ERROR_URL + "?code=connection");
      return false;
    }
  }

  /**
   * Apply global Principal ("Super Admin") sidebar & feature rules driven by .env:
   * - Sidebar role label under username -> "Principal" (or configured label)
   * - Hide History tab when can_view_history_tab is false (and redirect if on adminHistory.html)
   * - Hide Accounts sub-tab and disable employee write buttons on adminEmployees.html when configured
   */
  function applyPrincipalGlobalRules(data) {
    const flags = (data && data.principal_features) || {};
    const isPrincipal = Boolean(data && data.is_principal);
    const displayRole = data.display_role_name || data.role_name || "Admin";

    // Redirect away from adminHistory.html if History tab is turned off for Principal
    if (isPrincipal && flags.can_view_history_tab === false) {
      if (/adminHistory\.html/i.test(window.location.pathname)) {
        window.location.replace(`${BASE}/Pages/Admin/adminDashboard.html`);
        return;
      }
    }

    function enforceDomRules() {
      // 1. Set and lock sidebar role label (e.g. "Principal")
      const roleEls = document.querySelectorAll("#adminRole, #profileSidebarRole, .sidebar-role");
      roleEls.forEach((el) => {
        if (el.textContent !== displayRole) {
          el.textContent = displayRole;
        }
      });

      const nameEl = document.querySelector("#adminUsername, #profileSidebarName, .sidebar-name");
      if (nameEl && data.username && (nameEl.textContent === "Loading..." || !nameEl.textContent.trim())) {
        nameEl.textContent = data.username;
      }

      if (!isPrincipal) return;

      // 2. Hide History tab in sidebar if can_view_history_tab === false
      if (flags.can_view_history_tab === false) {
        document.querySelectorAll('.sidebar-nav a[href*="adminHistory.html"]').forEach((link) => {
          const li = link.closest("li");
          if (li) li.style.display = "none";
          else link.style.display = "none";
        });
      }

      // 3. Employees page: Hide Accounts sub-tab if can_view_accounts_subtab === false
      if (flags.can_view_accounts_subtab === false) {
        const btnAccounts = document.getElementById("btnAccounts");
        if (btnAccounts) {
          const li = btnAccounts.closest("li");
          if (li) li.style.display = "none";
          else btnAccounts.style.display = "none";
        }
        const panelAccounts = document.getElementById("panel-accounts");
        if (panelAccounts) {
          panelAccounts.style.display = "none";
        }
      }

      // 4. Employees page: Disable Add Employee, Master File Upload, and Edit buttons if can_edit_employees === false
      if (flags.can_edit_employees === false) {
        document.querySelectorAll(".btn-add-employee, #openBtn").forEach((btn) => {
          btn.disabled = true;
          btn.style.opacity = "0.48";
          btn.style.cursor = "not-allowed";
          btn.style.pointerEvents = "none";
          btn.title = "Disabled for Principal view";
        });

        document.querySelectorAll(".emp-table button, .btn-edit-employee").forEach((btn) => {
          if (/edit/i.test(btn.textContent || "")) {
            btn.disabled = true;
            btn.style.opacity = "0.48";
            btn.style.cursor = "not-allowed";
            btn.style.pointerEvents = "none";
            btn.title = "Disabled for Principal view";
          }
        });
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        enforceDomRules();
        const obs = new MutationObserver(enforceDomRules);
        obs.observe(document.body, { childList: true, subtree: true });
      });
    } else {
      enforceDomRules();
      const obs = new MutationObserver(enforceDomRules);
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  const ready = verifyAdminSession();

  // Other Admin scripts can wait for this verification.
  window.PERSYSAdminGuard = {
    ready,
    getSession: () => sessionData,
    getPrincipalFeatures: () => (sessionData && sessionData.principal_features) || {}
  };

  // Shared session info (used by switchAccount.js).
  window.PERSYSSession = {
    ready: ready.then((ok) => (ok ? sessionData : null))
  };
})();
