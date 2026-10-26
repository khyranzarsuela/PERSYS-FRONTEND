/**
 * PERSYS — Admin Dashboard · UI Interactions
 * -------------------------------------------------------
 * Scope: client-side UI only.
 *   - Active navigation link highlight
 *   - Mobile sidebar open / close toggle
 *   - Sidebar overlay click-to-close
 *   - Keyboard accessibility (Escape to close sidebar)
 * -------------------------------------------------------
 * NO mock data, NO fake fetches, NO fake alerts.
 * -------------------------------------------------------
 */

(function () {
  'use strict';

  // ── Element references ──────────────────────────────────
  const sidebar        = document.getElementById('sidebar');
  const overlay        = document.getElementById('sidebarOverlay');
  const hamburger      = document.getElementById('hamburger');
  const navItems       = document.querySelectorAll('.nav-item');

  // ── 1. ACTIVE NAVIGATION HIGHLIGHT ────────────────────
  // Marks the clicked nav item as active and removes the
  // class from all siblings. This is purely a visual state
  // toggle — routing / page loads are handled elsewhere.

  navItems.forEach(function (item) {
    item.addEventListener('click', function () {
      // Remove active from every item
      navItems.forEach(function (el) {
        el.classList.remove('active');
        el.removeAttribute('aria-current');
      });

      // Apply active to the clicked item
      this.classList.add('active');
      this.setAttribute('aria-current', 'page');

      // On mobile: close the sidebar after selecting a page
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
  });

  // ── 2. MOBILE SIDEBAR TOGGLE ──────────────────────────
  // The hamburger button shows/hides the off-canvas sidebar
  // on viewports ≤ 768px (controlled via CSS .is-open).

  if (hamburger) {
    hamburger.addEventListener('click', function () {
      const isOpen = sidebar.classList.contains('is-open');
      isOpen ? closeSidebar() : openSidebar();
    });
  }

  // ── 3. OVERLAY CLICK — CLOSE SIDEBAR ──────────────────
  // Tapping the darkened overlay dismisses the sidebar on
  // mobile without needing to click the hamburger again.

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // ── 4. KEYBOARD — ESCAPE TO CLOSE ─────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
      closeSidebar();
      if (hamburger) hamburger.focus(); // return focus for a11y
    }
  });

  // ── 5. HELPERS ─────────────────────────────────────────

  /** Opens the mobile sidebar and shows the overlay. */
  function openSidebar() {
    sidebar.classList.add('is-open');
    overlay.classList.add('is-visible');
    hamburger.classList.add('is-open');
    hamburger.setAttribute('aria-expanded', 'true');
    // Trap scroll on body while sidebar is open
    document.body.style.overflow = 'hidden';
  }

  /** Closes the mobile sidebar and hides the overlay. */
  function closeSidebar() {
    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-visible');
    if (hamburger) {
      hamburger.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
    document.body.style.overflow = '';
  }

  // ── 6. RESIZE GUARD ───────────────────────────────────
  // If the user resizes from mobile → desktop while the
  // sidebar is open, reset state so nothing is stuck.

  window.addEventListener('resize', function () {
    if (window.innerWidth > 768 && sidebar.classList.contains('is-open')) {
      closeSidebar();
    }
  });

  
})();



/* ============================================================
   GLOBAL LOGOUT — Shared by all migrated Admin pages
   ============================================================ */

(function () {
  'use strict';

  const logoutButtons = document.querySelectorAll('.btn-logout');
  const modal = document.getElementById('logoutModal');
  const cancelButton = document.getElementById('cancelLogoutBtn');
  const confirmButton = document.getElementById('confirmLogoutBtn');

  // Pages without a logout button or modal do not need this handler.
  if (
    !logoutButtons.length ||
    !modal ||
    !cancelButton ||
    !confirmButton
  ) {
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

  // Clicking the dark backdrop closes the modal.
  modal.addEventListener('click', function (event) {
    if (event.target === modal) {
      closeLogoutModal();
    }
  });

  // Escape closes the confirmation modal.
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
        headers: {
          Accept: 'application/json'
        }
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Unable to log out. Please try again.'
        );
      }

      // Return to the new frontend login page.
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


/* ============================================================
   PROFILE PAGE — UI Interactions
   Guard: only runs when #profilePasswordToggle exists in DOM,
   so this block is a no-op on every other admin page.
   ============================================================ */
 
(function () {
  'use strict';

  // ── Element references ────────────────────────────────────
  const eyeBtn       = document.getElementById('profilePasswordToggle');
  const passwordVal  = document.getElementById('profilePasswordValue');

  // Exit immediately if we're not on the profile page
  if (!eyeBtn || !passwordVal) return;

  // The real password text is stored in a data attribute so the
  // masked display (dots) is the default shown state.
  const MASKED = '••••••';

  // Ensure the masked value is shown on load
  passwordVal.textContent = MASKED;

  // ── PASSWORD SHOW / HIDE TOGGLE ───────────────────────────
  eyeBtn.addEventListener('click', function () {
    const isHidden = !this.classList.contains('is-visible');

    if (isHidden) {
      // Reveal: swap dots → actual value from data attribute
      const actual = passwordVal.dataset.password;
      passwordVal.textContent = actual;
      passwordVal.style.letterSpacing = '0.02em';
      this.classList.add('is-visible');
      this.setAttribute('aria-pressed', 'true');
      this.setAttribute('aria-label', 'Hide password');
    } else {
      // Conceal: swap actual value → dots
      passwordVal.textContent = MASKED;
      passwordVal.style.letterSpacing = '0.12em';
      this.classList.remove('is-visible');
      this.setAttribute('aria-pressed', 'false');
      this.setAttribute('aria-label', 'Show password');
    }
  });

  
})();
