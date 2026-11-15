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
      document.documentElement.style.visibility = "visible";
      return true;

    } catch (error) {
      console.error("Admin session verification failed:", error);
      window.location.replace(ERROR_URL + "?code=connection");
      return false;
    }
  }

  const ready = verifyAdminSession();

  // Other Admin scripts can wait for this verification.
  window.PERSYSAdminGuard = { ready };

  // Shared session info (used by switchAccount.js).
  window.PERSYSSession = {
    ready: ready.then((ok) => (ok ? sessionData : null))
  };
})();
