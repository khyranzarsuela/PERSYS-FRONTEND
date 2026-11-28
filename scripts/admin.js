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


/* ============================================================
   GLOBAL NOTIFICATION & CONFIRMATION MODAL (window.PERSYSModal)
   Uses the standard .modal-overlay / .modal-box design.
   ============================================================ */

(function () {
  'use strict';

  let activeResolver = null;

  function ensureModalElements() {
    let modal = document.getElementById('persysNotifyModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'persysNotifyModal';
      modal.style.display = 'none';
      modal.style.zIndex = '200';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'persysNotifyModalTitle');
      modal.innerHTML =
        '<div class="modal-box">' +
          '<div class="modal-header">' +
            '<h2 id="persysNotifyModalTitle">Notice</h2>' +
          '</div>' +
          '<div class="modal-body">' +
            '<p id="persysNotifyModalMessage"></p>' +
          '</div>' +
          '<div class="modal-footer">' +
            '<button type="button" id="persysNotifyCancelBtn" class="btn-secondary" style="display:none;">Cancel</button>' +
            '<button type="button" id="persysNotifyConfirmBtn" class="btn-yellow">OK</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
    }

    const titleEl    = document.getElementById('persysNotifyModalTitle');
    const messageEl  = document.getElementById('persysNotifyModalMessage');
    const cancelBtn  = document.getElementById('persysNotifyCancelBtn');
    const confirmBtn = document.getElementById('persysNotifyConfirmBtn');

    if (!modal.dataset.wired) {
      modal.dataset.wired = '1';

      confirmBtn.addEventListener('click', function () {
        closeDialog(true);
      });

      cancelBtn.addEventListener('click', function () {
        closeDialog(false);
      });

      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          closeDialog(false);
        }
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.style.display !== 'none') {
          closeDialog(false);
        }
      });
    }

    return { modal, titleEl, messageEl, cancelBtn, confirmBtn };
  }

  function closeDialog(result) {
    const modal = document.getElementById('persysNotifyModal');
    if (modal) {
      modal.style.display = 'none';
    }
    if (typeof activeResolver === 'function') {
      const resolve = activeResolver;
      activeResolver = null;
      resolve(Boolean(result));
    }
  }

  function openDialog(options) {
    const opts = options || {};
    const { modal, titleEl, messageEl, cancelBtn, confirmBtn } = ensureModalElements();

    if (activeResolver) {
      const prev = activeResolver;
      activeResolver = null;
      prev(false);
    }

    titleEl.textContent = opts.title || 'Notice';
    messageEl.textContent = opts.message || '';

    if (opts.isConfirm) {
      cancelBtn.style.display = 'inline-flex';
      cancelBtn.textContent = opts.cancelText || 'Cancel';
      confirmBtn.textContent = opts.confirmText || 'OK';
    } else {
      cancelBtn.style.display = 'none';
      confirmBtn.textContent = opts.confirmText || 'OK';
    }

    modal.style.display = 'flex';
    setTimeout(function () {
      confirmBtn.focus();
    }, 20);

    return new Promise(function (resolve) {
      activeResolver = resolve;
    });
  }

  window.PERSYSModal = {
    alert: function (message, title, confirmText) {
      return openDialog({
        isConfirm: false,
        title: title || 'Notice',
        message: message,
        confirmText: confirmText || 'OK'
      });
    },
    confirm: function (message, title, confirmText, cancelText) {
      return openDialog({
        isConfirm: true,
        title: title || 'Confirm Action',
        message: message,
        confirmText: confirmText || 'OK',
        cancelText: cancelText || 'Cancel'
      });
    }
  };
})();
