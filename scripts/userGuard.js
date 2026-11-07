/* ============================================================
   PERSYS — Shared User Authentication Guard
   Mirrors adminGuard.js but allows role_id 2 (Teaching) and
   role_id 3 (Non-Teaching). Exposes window.PERSYSUserGuard.
   ============================================================ */

(function () {
  "use strict";

  const API_URL =
    `${window.PERSYS_CONFIG.API_BASE_URL}/api/auth/me.php`;

  const LOGIN_URL =
    `${window.PERSYS_CONFIG.FRONTEND_BASE_URL}/index.html`;

  const ERROR_URL =
    `${window.PERSYS_CONFIG.FRONTEND_BASE_URL}/error.html`;

  // Hide protected page content while the session is checked.
  document.documentElement.style.visibility = "hidden";

  async function verifyUserSession() {
    try {
      const response = await fetch(API_URL, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
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

      const roleId = Number(result.data.role_id);

      // Role IDs 2 (Teaching) and 3 (Non-Teaching) are user roles.
      // Role ID 1 is Admin — redirect admins away from user pages.
      if (roleId !== 2 && roleId !== 3) {
        window.location.replace(ERROR_URL + "?code=403");
        return false;
      }

      // Session and user role verified — reveal the page.
      document.documentElement.style.visibility = "visible";

      return true;
    } catch (error) {
      console.error("User session verification failed:", error);

      window.location.replace(
        ERROR_URL + "?code=connection"
      );

      return false;
    }
  }

  // Other user scripts can wait for this verification.
  window.PERSYSUserGuard = {
    ready: verifyUserSession()
  };
})();
