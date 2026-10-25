/* ============================================================
   PERSYS — Shared API Error Handler
   ============================================================ */

(function () {
  "use strict";

  const BASE_URL = "/PERSYS-FRONTEND";
  const LOGIN_URL = BASE_URL + "/index.html";
  const ERROR_URL = BASE_URL + "/error.html";

  // Only these pages are permitted as retry destinations.
  const ALLOWED_RETRY_PATHS = new Set([
    BASE_URL + "/Pages/Admin/adminDashboard.html",
    BASE_URL + "/Pages/Admin/adminProfile.html"
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

  async function handleResponse(response) {
    if (response.status === 401) {
      window.location.replace(LOGIN_URL);
      return null;
    }

    if (response.status === 403) {
      redirectToError("403");
      return null;
    }

    if (response.status >= 500) {
      redirectToError("500");
      return null;
    }

    if (!response.ok) {
      throw new Error("Request failed. Please try again.");
    }

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
