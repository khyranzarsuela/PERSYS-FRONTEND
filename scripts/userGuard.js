/* ============================================================
   PERSYS — Shared User Authentication Guard
   ------------------------------------------------------------
   User pages require the USER VIEW. That is:
     - Teaching (2) / Non-Teaching (3) accounts, always
     - Admins (1) who switched to user view via Switch Account

   - Not logged in                     → login page
   - Admin currently in admin view     → admin dashboard
   - Anything else                     → 403 error page
   ============================================================ */

(function () {
  "use strict";

  const API_URL =
    `${window.PERSYS_CONFIG.API_BASE_URL}/api/auth/me.php`;

  const BASE = window.PERSYS_CONFIG.FRONTEND_BASE_URL;
  const LOGIN_URL = `${BASE}/index.html`;
  const ERROR_URL = `${BASE}/error.html`;
  const ADMIN_DASHBOARD_URL = `${BASE}/Pages/Admin/adminDashboard.html`;

  // Hide protected page content while the session is checked.
  document.documentElement.style.visibility = "hidden";

  let sessionData = null;

  async function verifyUserSession() {
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
      const roleId = Number(data.role_id);
      const isAdmin = roleId === 1;
      const isUserRole = roleId === 2 || roleId === 3;
      // Older backends have no active_view: derive it from the role.
      const activeView = data.active_view || (isAdmin ? "admin" : "user");

      if (activeView === "user" && (isUserRole || isAdmin)) {
        sessionData = data;
        document.documentElement.style.visibility = "visible";
        return true;
      }

      // Admin still in admin view → send them to their admin side.
      window.location.replace(
        isAdmin ? ADMIN_DASHBOARD_URL : ERROR_URL + "?code=403"
      );
      return false;

    } catch (error) {
      console.error("User session verification failed:", error);
      window.location.replace(ERROR_URL + "?code=connection");
      return false;
    }
  }

  const ready = verifyUserSession();

  // Other user scripts can wait for this verification.
  window.PERSYSUserGuard = { ready };

  // Shared session info (used by switchAccount.js).
  window.PERSYSSession = {
    ready: ready.then((ok) => (ok ? sessionData : null))
  };
})();
