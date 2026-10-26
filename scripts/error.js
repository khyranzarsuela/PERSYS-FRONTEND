(function () {
  'use strict';

  const LOGIN_URL =
  `${window.PERSYS_CONFIG.FRONTEND_BASE_URL}/index.html`;
  const DASHBOARD_URL =
  `${window.PERSYS_CONFIG.FRONTEND_BASE_URL}/Pages/Admin/adminDashboard.html`;

  const errorTypes = {
    '404': {
      title: 'Page Not Found',
      description:
        "The page you're looking for doesn't exist, was moved, or the address may be incorrect.",
      label: 'PAGE NOT FOUND',
      symbol: '?',
      primary: 'Back to Login',
      secondary: 'Go to Dashboard'
    },
    '403': {
      title: 'Access Denied',
      description:
        "You don't have permission to access this page. Please use an account with the appropriate access.",
      label: 'ACCESS RESTRICTED',
      symbol: '!',
      primary: 'Back to Login',
      secondary: 'Go to Dashboard'
    },
    '401': {
      title: 'Session Expired',
      description:
        'Your session has ended or you are not signed in. Please log in to continue.',
      label: 'AUTHENTICATION REQUIRED',
      symbol: '!',
      primary: 'Back to Login',
      secondary: null
    },
    '500': {
      title: 'Something Went Wrong',
      description:
        'An unexpected server error occurred. Please try again later or contact your system administrator.',
      label: 'SERVER ERROR',
      symbol: '!',
      primary: 'Try Again',
      secondary: 'Go to Dashboard'
    },
    'connection': {
      title: 'Connection Problem',
      description:
        'PERSYS could not connect to the server. Check your connection or try again shortly.',
      label: 'CONNECTION ERROR',
      symbol: '!',
      primary: 'Try Again',
      secondary: 'Back to Login'
    }
  };

  const params = new URLSearchParams(window.location.search);
  const requestedCode = params.get('code') || '404';

  // Unknown error codes use the safe 404 fallback.
  const code = Object.hasOwn(errorTypes, requestedCode)
    ? requestedCode
    : '404';

  const error = errorTypes[code];

  const codeElement = document.getElementById('error-code');
  const titleElement = document.getElementById('error-title');
  const descriptionElement =
    document.getElementById('error-description');
  const labelElement = document.getElementById('error-label');
  const symbolElement = document.getElementById('document-symbol');
  const primaryAction = document.getElementById('primary-action');
  const secondaryAction = document.getElementById('secondary-action');

  const displayCode = code === 'connection' ? 'OFFLINE' : code;

  codeElement.textContent = displayCode;
  titleElement.textContent = error.title;
  descriptionElement.textContent = error.description;
  labelElement.textContent = error.label;
  symbolElement.textContent = error.symbol;

  document.title = `${error.title} | PERSYS`;

  // Approved retry destinations for migrated PERSYS pages.
  const ALLOWED_RETRY_PATHS = new Set([
    DASHBOARD_URL,
    `${window.PERSYS_CONFIG.FRONTEND_BASE_URL}/Pages/Admin/adminProfile.html`
  ]);

  // Read the original page from the error URL.
  const requestedRetryPath = params.get("from");

  // Never trust arbitrary destinations from URL parameters.
  const retryDestination = ALLOWED_RETRY_PATHS.has(requestedRetryPath)? requestedRetryPath : DASHBOARD_URL;

  if (error.primary === 'Try Again') {
    primaryAction.textContent = 'Try Again';
    primaryAction.href = retryDestination;
  } else {
    primaryAction.textContent = error.primary;
    primaryAction.href = LOGIN_URL;
  }

  if (!error.secondary) {
    secondaryAction.hidden = true;
  } else {
    secondaryAction.textContent = error.secondary;
    secondaryAction.href =
      error.secondary === 'Back to Login'
        ? LOGIN_URL
        : DASHBOARD_URL;
  }
})();