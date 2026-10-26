// PERSYS Frontend API Configuration

(function () {
  "use strict";

  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  const API_BASE_URL = isLocal
    ? "/PERSYS-BACKEND"
    : "";

  const FRONTEND_BASE_URL = isLocal
    ? "/PERSYS-FRONTEND"
    : "";

  window.PERSYS_CONFIG = Object.freeze({
    isLocal,
    API_BASE_URL,
    FRONTEND_BASE_URL
  });
})();