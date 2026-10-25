/* ============================================================
   PERSYS — Shared Admin Authentication Guard
   ============================================================ */

(function () {
  "use strict";

  const API_URL =
    "/PERSYS-BACKEND/api/auth/me.php";

  const LOGIN_URL = "/PERSYS-FRONTEND/index.html";
  const ERROR_URL = "/PERSYS-FRONTEND/error.html";

  // Hide protected page content while the session is checked.
  document.documentElement.style.visibility = "hidden";

  async function verifyAdminSession() {
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

    // Role ID 1 is the Admin role in PERSYS.
    if (Number(result.data.role_id) !== 1) {
      window.location.replace(ERROR_URL + "?code=403");
      return false;
    }

    // Session and Admin role verified.
    document.documentElement.style.visibility = "visible";

    return true;
    } catch (error) {
      console.error("Admin session verification failed:", error);

      window.location.replace(
        ERROR_URL + "?code=connection"
      );

      return false;
    }
  }

  // Other Admin scripts can wait for this verification.
  window.PERSYSAdminGuard = {
    ready: verifyAdminSession()
  };
})();
