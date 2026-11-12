/**
 * PERSYS — User Pages · UI Interactions
 * -------------------------------------------------------
 * Scope: client-side UI only.
 *   - Active navigation link highlight
 *   - Mobile sidebar open / close toggle
 *   - Sidebar overlay click-to-close
 *   - Keyboard accessibility (Escape to close sidebar)
 *   - Profile page password show/hide
 *   - Logout modal (fetch-based, no jQuery)
 * -------------------------------------------------------
 * NO mock data, NO fake fetches, NO fake alerts.
 * -------------------------------------------------------
 */

/* ============================================================
   SIDEBAR — shared by all User pages
   ============================================================ */
(function () {
  'use strict';

  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburger');
  const navItems  = document.querySelectorAll('.nav-item');

  // ── 1. ACTIVE NAVIGATION HIGHLIGHT ────────────────────────
  navItems.forEach(function (item) {
    item.addEventListener('click', function () {
      navItems.forEach(function (el) {
        el.classList.remove('active');
        el.removeAttribute('aria-current');
      });
      this.classList.add('active');
      this.setAttribute('aria-current', 'page');

      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
  });

  // ── 2. MOBILE SIDEBAR TOGGLE ──────────────────────────────
  if (hamburger) {
    hamburger.addEventListener('click', function () {
      const isOpen = sidebar.classList.contains('is-open');
      isOpen ? closeSidebar() : openSidebar();
    });
  }

  // ── 3. OVERLAY CLICK — CLOSE SIDEBAR ──────────────────────
  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // ── 4. KEYBOARD — ESCAPE TO CLOSE ─────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
      closeSidebar();
      if (hamburger) hamburger.focus();
    }
  });

  // ── 5. HELPERS ─────────────────────────────────────────────
  function openSidebar() {
    sidebar.classList.add('is-open');
    overlay.classList.add('is-visible');
    hamburger.classList.add('is-open');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-visible');
    if (hamburger) {
      hamburger.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
    document.body.style.overflow = '';
  }

  // ── 6. RESIZE GUARD ───────────────────────────────────────
  window.addEventListener('resize', function () {
    if (window.innerWidth > 768 && sidebar.classList.contains('is-open')) {
      closeSidebar();
    }
  });

})();


/* ============================================================
   PROFILE PAGE — password show/hide
   Guard: only runs when #profilePasswordToggle exists in DOM.
   ============================================================ */
(function () {
  'use strict';

  const eyeBtn     = document.getElementById('profilePasswordToggle');
  const passwordVal = document.getElementById('profilePasswordValue');

  if (!eyeBtn || !passwordVal) return;

  const MASKED = '••••••';

  passwordVal.textContent = MASKED;

  eyeBtn.addEventListener('click', function () {
    const isHidden = !this.classList.contains('is-visible');

    if (isHidden) {
      const actual = passwordVal.dataset.password;
      passwordVal.textContent = actual;
      passwordVal.style.letterSpacing = '0.02em';
      this.classList.add('is-visible');
      this.setAttribute('aria-pressed', 'true');
      this.setAttribute('aria-label', 'Hide password');
    } else {
      passwordVal.textContent = MASKED;
      passwordVal.style.letterSpacing = '0.12em';
      this.classList.remove('is-visible');
      this.setAttribute('aria-pressed', 'false');
      this.setAttribute('aria-label', 'Show password');
    }
  });

})();


/* ============================================================
   LOGOUT MODAL — present on any page with .btn-logout
   Uses fetch-based pattern. No jQuery dependency.
   ============================================================ */
(function () {
  'use strict';

  const logoutButtons = document.querySelectorAll('.btn-logout');
  const modal         = document.getElementById('logoutModal');
  const cancelButton  = document.getElementById('cancelLogoutBtn');
  const confirmButton = document.getElementById('confirmLogoutBtn');

  if (!logoutButtons.length || !modal || !cancelButton || !confirmButton) {
    return;
  }

  const API_URL =
    `${window.PERSYS_CONFIG.API_BASE_URL}/api/auth/logout.php`;

  function openLogoutModal() {
    modal.style.display = 'flex';
    confirmButton.disabled = false;
    confirmButton.textContent = 'Log Out';
  }

  function closeLogoutModal() {
    modal.style.display = 'none';
  }

  logoutButtons.forEach(function (button) {
    button.addEventListener('click', openLogoutModal);
  });

  cancelButton.addEventListener('click', closeLogoutModal);

  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeLogoutModal();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && modal.style.display !== 'none') {
      closeLogoutModal();
    }
  });

  confirmButton.addEventListener('click', async function () {
    confirmButton.disabled = true;
    confirmButton.textContent = 'Logging out...';

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to log out. Please try again.');
      }

      window.location.replace(
        `${window.PERSYS_CONFIG.FRONTEND_BASE_URL}/index.html`
      );

    } catch (error) {
      console.error('Logout error:', error);

      confirmButton.disabled = false;
      confirmButton.textContent = 'Log Out';

      alert(
        error.message === 'Failed to fetch'
          ? 'Unable to connect to the logout API. Check that XAMPP is running.'
          : error.message
      );
    }
  });

})();
