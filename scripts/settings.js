/**
 * PERSYS — Global Accessibility Preferences
 * ============================================================
 * Handles: Font Size, Text Spacing, Dark Mode
 *
 * Strategy:
 *   - On every page: reads localStorage and applies preferences
 *     immediately (CSS vars + data-theme attribute).
 *   - On the Settings page only: wires up slider/button controls,
 *     saves to localStorage AND to the DB via AJAX.
 *
 * The PHP settings pages inject an inline <script> that seeds
 * localStorage with the authoritative DB values before this file
 * runs, so the two sources stay in sync automatically.
 * ============================================================
 */
(function () {
  'use strict';

  var root = document.documentElement;

  // ── Storage keys ─────────────────────────────────────────
  var KEYS = {
    fontSize:    'persysFontSize',
    textSpacing: 'persysTextSpacing',
    theme:       'persysTheme'
  };

  // ── Helpers ───────────────────────────────────────────────

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function readPref(key, fallback) {
    var v = localStorage.getItem(key);
    return v === null ? fallback : v;
  }

  function savePref(key, value) {
    localStorage.setItem(key, String(value));
  }

  // Debounce: delay DB saves while the user is still dragging.
  function debounce(fn, ms) {
    var timer;
    return function () {
      var ctx  = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  // ── Apply functions ───────────────────────────────────────

  /**
   * Apply font size (12–24 px, step 4 → Small / Medium / Large).
   * Updates CSS vars, slider, and display badge if they exist.
   */
  function applyFontSize(value) {
    var size = clamp(Number(value) || 16, 12, 24);

    root.style.setProperty('--app-font-size',    size + 'px');
    root.style.setProperty('--persys-font-size', size + 'px');

    var slider  = document.getElementById('fontSizeSlider');
    var display = document.getElementById('fontSizeVal');
    if (slider)  slider.value        = size;
    if (display) display.textContent = size + 'px';

    return size;
  }

  /**
   * Apply text spacing (0–5 px, step 0.5).
   * Sets letter-spacing and derives a proportional line-height.
   */
  function applyTextSpacing(value) {
    var spacing = clamp(Number(value) || 0, 0, 5);

    root.style.setProperty('--app-letter-spacing', spacing + 'px');
    root.style.setProperty('--app-line-height',    String(1.5 + spacing * 0.05));

    var slider  = document.getElementById('textSpacingSlider');
    var display = document.getElementById('textSpacingVal');
    if (slider)  slider.value        = spacing;
    if (display) display.textContent = spacing + 'px';

    return spacing;
  }

  /**
   * Apply dark / light theme.
   * Sets data-theme on <html> and keeps the mode buttons in sync.
   */
  function applyTheme(value) {
    var theme = value === 'dark' ? 'dark' : 'light';

    root.dataset.theme = theme;

    document.querySelectorAll('.mode-option').forEach(function (btn) {
      var active = btn.dataset.mode === theme;
      btn.classList.toggle('selected', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    return theme;
  }

  // ── DB save functions (fire-and-forget AJAX) ──────────────

  function saveToDb(params) {
    var body = new URLSearchParams(params);
    fetch(window.location.href, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString()
    }).catch(function (err) {
      console.warn('PERSYS: could not save setting to DB —', err);
    });
  }

  var saveDbFontSize = debounce(function (size) {
    saveToDb({ ajax_save_font_size: '1', font_size: size + 'px' });
  }, 500);

  var saveDbTextSpacing = debounce(function (spacing) {
    saveToDb({ ajax_save_text_spacing: '1', text_spacing: String(spacing) });
  }, 500);

  function saveDbTheme(theme) {
    saveToDb({ ajax_save_dark_mode: '1', dark_mode: theme === 'dark' ? '1' : '0' });
  }

  // ── Restore preferences on every page load ────────────────
  // The PHP inline script already seeded localStorage with DB
  // values, so these reads are authoritative.

  applyFontSize(readPref(KEYS.fontSize, '16'));
  applyTextSpacing(readPref(KEYS.textSpacing, '0'));
  applyTheme(readPref(KEYS.theme, 'light'));

  // ── Wire up controls (Settings page only) ─────────────────
  // All getElementById / querySelectorAll calls below are
  // no-ops on non-Settings pages — the elements simply won't
  // exist, so nothing is attached.

  // Font size slider
  var fontSlider = document.getElementById('fontSizeSlider');
  if (fontSlider) {
    fontSlider.addEventListener('input', function () {
      var size = applyFontSize(this.value);
      savePref(KEYS.fontSize, size);
      saveDbFontSize(size);
    });
  }

  // Text spacing slider
  var spacingSlider = document.getElementById('textSpacingSlider');
  if (spacingSlider) {
    spacingSlider.addEventListener('input', function () {
      var spacing = applyTextSpacing(this.value);
      savePref(KEYS.textSpacing, spacing);
      saveDbTextSpacing(spacing);
    });
  }

  // Light / Dark mode buttons
  document.querySelectorAll('.mode-option').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var theme = applyTheme(this.dataset.mode);
      savePref(KEYS.theme, theme);
      saveDbTheme(theme);
    });
  });

})();
