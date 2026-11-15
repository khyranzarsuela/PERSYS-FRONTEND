/**
 * PERSYS — Global Accessibility & Appearance Preferences (Cookie-Based)
 * =====================================================================
 * Handles:
 *   1. Theme (Light Mode / Dark Mode)      -> cookie: persysTheme
 *   2. Font Size (12px – 24px)             -> cookie: persysFontSize
 *   3. Letter Spacing (0px – 5px, step 0.5)-> cookie: persysTextSpacing
 *
 * Storage Strategy:
 *   - Stored strictly in browser cookies (NO database storage).
 *   - Long-lived expiration: 1 Year (max-age=31536000; path=/; SameSite=Lax).
 *   - Applied immediately on every Admin and User page load.
 * =====================================================================
 */
(function () {
  'use strict';

  var root = document.documentElement;

  // 1-year cookie lifetime in seconds (365 days)
  var COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

  var KEYS = {
    fontSize:    'persysFontSize',
    textSpacing: 'persysTextSpacing',
    theme:       'persysTheme'
  };

  var DEFAULTS = {
    fontSize:    16,
    textSpacing: 0,
    theme:       'light'
  };

  var toastTimer = null;

  // ── Cookie Helpers ────────────────────────────────────────

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getCookie(name) {
    var prefix = encodeURIComponent(name) + '=';
    var parts = (document.cookie || '').split(';');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (part.indexOf(prefix) === 0) {
        try {
          return decodeURIComponent(part.substring(prefix.length));
        } catch (e) {
          return part.substring(prefix.length);
        }
      }
    }
    return null;
  }

  function setCookie(name, value) {
    var expires = new Date(Date.now() + COOKIE_MAX_AGE * 1000).toUTCString();
    document.cookie =
      encodeURIComponent(name) + '=' + encodeURIComponent(String(value)) +
      '; max-age=' + COOKIE_MAX_AGE +
      '; expires=' + expires +
      '; path=/; SameSite=Lax';
  }

  /**
   * Reads a preference from browser cookies.
   * If a cookie doesn't exist yet but a legacy localStorage value exists,
   * migrates it into a long-lived cookie once and removes the legacy key.
   */
  function readPref(key, fallback) {
    var cookieVal = getCookie(key);
    if (cookieVal !== null && cookieVal !== '') {
      return cookieVal;
    }

    try {
      var legacyVal = localStorage.getItem(key);
      if (legacyVal !== null && legacyVal !== '') {
        setCookie(key, legacyVal);
        localStorage.removeItem(key);
        return legacyVal;
      }
    } catch (e) {
      // Ignore storage errors in restricted contexts
    }

    return String(fallback);
  }

  function savePref(key, value) {
    setCookie(key, value);
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Ignore storage errors
    }
    showSavedToast();
  }

  function showSavedToast(customText) {
    var toast = document.getElementById('settingsSaveToast');
    if (!toast) return;

    var labelEl = toast.querySelector('.toast-text');
    if (labelEl) {
      labelEl.textContent = customText || 'Saved to browser cookies';
    }

    toast.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2200);
  }

  // ── Apply Functions ───────────────────────────────────────

  /**
   * Apply font size (12–24 px).
   * Updates CSS variables, slider, display badge, preset pills, and summary.
   */
  function applyFontSize(value) {
    var parsed = Number(value);
    var size = clamp(Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULTS.fontSize, 12, 24);

    root.style.setProperty('--app-font-size',    size + 'px');
    root.style.setProperty('--persys-font-size', size + 'px');

    var slider  = document.getElementById('fontSizeSlider');
    var display = document.getElementById('fontSizeVal');
    var summary = document.getElementById('summaryFontVal');

    if (slider)  slider.value        = String(size);
    if (display) display.textContent = size + 'px';
    if (summary) summary.textContent = size + 'px';

    document.querySelectorAll('.font-preset-btn').forEach(function (btn) {
      var btnSize = Number(btn.dataset.size);
      var active = btnSize === size;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    return size;
  }

  /**
   * Apply letter spacing (0–5 px, step 0.5).
   * Sets --app-letter-spacing and proportional --app-line-height.
   */
  function applyTextSpacing(value) {
    var parsed = Number(value);
    var raw = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULTS.textSpacing;
    var spacing = Math.round(clamp(raw, 0, 5) * 2) / 2;

    root.style.setProperty('--app-letter-spacing', spacing + 'px');
    root.style.setProperty('--app-line-height',    String(1.5 + spacing * 0.05));

    var slider  = document.getElementById('textSpacingSlider');
    var display = document.getElementById('textSpacingVal');
    var summary = document.getElementById('summarySpacingVal');

    if (slider)  slider.value        = String(spacing);
    if (display) display.textContent = spacing + 'px';
    if (summary) summary.textContent = spacing === 0 ? '0px (Normal)' : spacing + 'px';

    document.querySelectorAll('.spacing-preset-btn').forEach(function (btn) {
      var btnSpacing = Number(btn.dataset.spacing);
      var active = Math.abs(btnSpacing - spacing) < 0.01;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    return spacing;
  }

  /**
   * Apply Light / Dark theme.
   * Sets data-theme on <html> and keeps mode buttons & summary in sync.
   */
  function applyTheme(value) {
    var theme = value === 'dark' ? 'dark' : 'light';

    root.dataset.theme = theme;

    document.querySelectorAll('.mode-option').forEach(function (btn) {
      var active = btn.dataset.mode === theme;
      btn.classList.toggle('selected', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    var summary = document.getElementById('summaryThemeVal');
    if (summary) {
      summary.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
    }

    var previewTag = document.getElementById('livePreviewThemeTag');
    if (previewTag) {
      previewTag.textContent = theme === 'dark' ? 'Live Preview • Dark Mode' : 'Live Preview • Light Mode';
    }

    return theme;
  }

  // ── Restore Preferences Immediately on Page Load ──────────

  applyFontSize(readPref(KEYS.fontSize, DEFAULTS.fontSize));
  applyTextSpacing(readPref(KEYS.textSpacing, DEFAULTS.textSpacing));
  applyTheme(readPref(KEYS.theme, DEFAULTS.theme));

  // Ensure initial cookies exist with 1-year expiry if visiting Settings page
  function syncSettingsPageControls() {
    var currentSize    = applyFontSize(readPref(KEYS.fontSize, DEFAULTS.fontSize));
    var currentSpacing = applyTextSpacing(readPref(KEYS.textSpacing, DEFAULTS.textSpacing));
    var currentTheme   = applyTheme(readPref(KEYS.theme, DEFAULTS.theme));

    // Font Size Slider
    var fontSlider = document.getElementById('fontSizeSlider');
    if (fontSlider) {
      setCookie(KEYS.fontSize, currentSize);
      setCookie(KEYS.textSpacing, currentSpacing);
      setCookie(KEYS.theme, currentTheme);

      fontSlider.addEventListener('input', function () {
        var size = applyFontSize(this.value);
        savePref(KEYS.fontSize, size);
      });
    }

    // Font Size Preset Pills
    document.querySelectorAll('.font-preset-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var size = applyFontSize(this.dataset.size);
        savePref(KEYS.fontSize, size);
      });
    });

    // Letter Spacing Slider
    var spacingSlider = document.getElementById('textSpacingSlider');
    if (spacingSlider) {
      spacingSlider.addEventListener('input', function () {
        var spacing = applyTextSpacing(this.value);
        savePref(KEYS.textSpacing, spacing);
      });
    }

    // Letter Spacing Preset Pills
    document.querySelectorAll('.spacing-preset-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var spacing = applyTextSpacing(this.dataset.spacing);
        savePref(KEYS.textSpacing, spacing);
      });
    });

    // Light / Dark Mode Cards
    document.querySelectorAll('.mode-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var theme = applyTheme(this.dataset.mode);
        savePref(KEYS.theme, theme);
      });
    });

    // Reset to Defaults Button
    var resetBtn = document.getElementById('resetSettingsBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        var size    = applyFontSize(DEFAULTS.fontSize);
        var spacing = applyTextSpacing(DEFAULTS.textSpacing);
        var theme   = applyTheme(DEFAULTS.theme);

        setCookie(KEYS.fontSize, size);
        setCookie(KEYS.textSpacing, spacing);
        setCookie(KEYS.theme, theme);

        showSavedToast('Reset to default preferences');
      });
    }
  }

  // ── Sidebar User Identity Loader (for Settings Pages) ─────

  function populateSettingsSidebarProfile() {
    if (!window.PERSYSSession || !window.PERSYSSession.ready) return;

    window.PERSYSSession.ready.then(function (session) {
      if (!session) return;

      var nameEl   = document.querySelector('#sidebar .sidebar-name');
      var roleEl   = document.querySelector('#sidebar .sidebar-role');
      var avatarEl = document.querySelector('#sidebar .sidebar-avatar');

      var username = session.username || 'User';
      var roleLabel = session.display_role_name || session.role_name || '';

      if (nameEl && (nameEl.textContent === 'Loading...' || !nameEl.textContent.trim())) {
        nameEl.textContent = username;
      }
      if (roleEl && (roleEl.textContent === 'Loading...' || !roleEl.textContent.trim())) {
        roleEl.textContent = roleLabel;
      }
      if (avatarEl && username) {
        var initial = encodeURIComponent(username.charAt(0).toUpperCase());
        avatarEl.src = 'https://placehold.co/72x72/6B0FBA/FFFFFF?text=' + initial;
      }
    }).catch(function () {
      // Ignore session display errors; guard handles redirects
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      syncSettingsPageControls();
      populateSettingsSidebarProfile();
    });
  } else {
    syncSettingsPageControls();
    populateSettingsSidebarProfile();
  }

})();
