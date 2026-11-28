/* ============================================================
   PERSYS — Shared API Error Handler
   ============================================================ */

(function () {
  "use strict";

  const BASE_URL = window.PERSYS_CONFIG.FRONTEND_BASE_URL;
  const LOGIN_URL = BASE_URL + "/index.html";
  const ERROR_URL = BASE_URL + "/error.html";

  // Only these pages are permitted as retry destinations.
  const ALLOWED_RETRY_PATHS = new Set([
    BASE_URL + "/Pages/Admin/adminDashboard.html",
    BASE_URL + "/Pages/Admin/adminProfile.html",
    BASE_URL + "/Pages/Users/userDashboard.html",
    BASE_URL + "/Pages/Users/userProfile.html",
    BASE_URL + "/Pages/Users/userServiceCredits.html",
    BASE_URL + "/Pages/Users/userRequest.html"
  ]);

  function getSafeRetryPath() {
    const currentPath = window.location.pathname;

    if (ALLOWED_RETRY_PATHS.has(currentPath)) {
      return currentPath;
    }

    return BASE_URL + "/Pages/Admin/adminDashboard.html";
  }

  function redirectToError(code) {
    const params = new URLSearchParams({
      code: String(code),
      from: getSafeRetryPath()
    });

    window.location.replace(
      ERROR_URL + "?" + params.toString()
    );
  }

  /**
   * If a 403 means "wrong view" (Switch Account), return the dashboard
   * URL for the view the account is really in. Otherwise null.
   */
  async function getWrongViewRedirect(response) {
    try {
      const body = await response.clone().json();

      if (!body || body.code !== "WRONG_VIEW" || !body.redirect) {
        return null;
      }

      let path = String(body.redirect);

      // Only accept our own dashboard paths.
      if (!/^\/PERSYS-FRONTEND\/Pages\/(Admin|Users)\/[A-Za-z]+\.html$/.test(path)) {
        return null;
      }

      if (!window.PERSYS_CONFIG.isLocal) {
        path = path.replace(/^\/PERSYS-FRONTEND(?=\/|$)/, "");
      }

      return path;
    } catch (error) {
      return null;
    }
  }

  async function handleResponse(response) {
    if (response.status === 401) {
      window.location.replace(LOGIN_URL);
      return null;
    }

    if (response.status === 403) {
      // Admin using the other view (e.g. switched in another tab):
      // go to the dashboard of the view they are actually in.
      const redirect = await getWrongViewRedirect(response);

      if (redirect) {
        window.location.replace(redirect);
        return null;
      }

      redirectToError("403");
      return null;
    }

    if (response.status >= 500) {
      redirectToError("500");
      return null;
    }

    // Return 2xx and 4xx (400, 404, 409, 422 validation/conflict) responses
    // so callers can read `await checkedResponse.json()` and display `result.message`.
    return response;
  }

  function handleNetworkError(error) {
    console.error("PERSYS API error:", error);

    if (error instanceof TypeError) {
      redirectToError("connection");
      return;
    }

    redirectToError("500");
  }

  window.PERSYSApiErrors = {
    handleResponse,
    handleNetworkError
  };
})();
