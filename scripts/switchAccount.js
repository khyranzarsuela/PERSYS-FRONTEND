/* ============================================================
   PERSYS — Switch Account (global, Admin + User pages)
   ------------------------------------------------------------
   Allows an Admin to switch between their Admin view and their
   User view without signing in again.

   - Waits for window.PERSYSSession.ready (or /api/auth/me.php)
     so regular users never see the switcher UI.
   - Fetches switchable accounts from GET /api/auth/accounts.php.
   - Switches active view via POST /api/auth/switch-account.php.
   ============================================================ */

(function () {
  'use strict';

  // Clean up any legacy frontend-only sessionStorage keys.
  [
    'persys_switched_role',
    'persys_admin_name',
    'persys_admin_role_name',
    'persys_user_type'
  ].forEach(function (key) {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      // Ignore storage access errors.
    }
  });

  var path = window.location.pathname;
  var isAdminPage = /\/Pages\/Admin\//i.test(path);
  var isUserPage = /\/Pages\/Users\//i.test(path);

  if (!isAdminPage && !isUserPage) return;

  var sidebar = document.getElementById('sidebar');
  var nameEl = sidebar && sidebar.querySelector('.sidebar-name');
  if (!sidebar || !nameEl) return;

  var apiBase = window.PERSYS_CONFIG ? window.PERSYS_CONFIG.API_BASE_URL : '';
  var ME_API = apiBase + '/api/auth/me.php';
  var ACCOUNTS_API = apiBase + '/api/auth/accounts.php';
  var SWITCH_API = apiBase + '/api/auth/switch-account.php';

  async function resolveSession() {
    if (window.PERSYSSession && window.PERSYSSession.ready) {
      return window.PERSYSSession.ready;
    }

    try {
      var response = await fetch(ME_API, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) return null;

      var result = await response.json();
      if (!result || !result.success || !result.data) return null;
      return result.data;
    } catch (err) {
      return null;
    }
  }

  async function init() {
    var session = await resolveSession();
    if (!session) return;

    var canSwitch = session.can_switch ?? (Number(session.role_id) === 1);
    if (!canSwitch) return;

    // ── 1. Inject trigger (wrap sidebar name + chevron) ──────
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'sidebar-profile-toggle';
    toggle.id = 'switchAccountToggle';
    toggle.setAttribute('aria-haspopup', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'switchAccountDropdown');
    toggle.setAttribute('aria-label', 'Switch account');

    nameEl.parentNode.insertBefore(toggle, nameEl);
    toggle.appendChild(nameEl);
    toggle.insertAdjacentHTML(
      'beforeend',
      '<svg class="sidebar-profile-chevron" viewBox="0 0 24 24" aria-hidden="true">' +
        '<polyline points="18 15 12 9 6 15"/></svg>'
    );

    // ── 2. Create dropdown (appended to body → never clipped) ──
    var dropdown = document.createElement('div');
    dropdown.className = 'switch-account-dropdown';
    dropdown.id = 'switchAccountDropdown';
    dropdown.setAttribute('role', 'dialog');
    dropdown.setAttribute('aria-label', 'Switch account');
    dropdown.innerHTML =
      '<div class="sa-header">' +
        '<p class="sa-header-title">Switch account (No sign-in required)</p>' +
        '<div class="sa-search-wrap">' +
          '<input type="text" class="sa-search-input" placeholder="Search users..." ' +
                 'autocomplete="off" aria-label="Search accounts" />' +
          '<svg class="sa-search-icon" viewBox="0 0 24 24" aria-hidden="true">' +
            '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>' +
          '</svg>' +
        '</div>' +
      '</div>' +
      '<ul class="sa-account-list"></ul>' +
      '<p class="sa-empty">No accounts found</p>';
    document.body.appendChild(dropdown);

    var listEl = dropdown.querySelector('.sa-account-list');
    var emptyEl = dropdown.querySelector('.sa-empty');
    var searchEl = dropdown.querySelector('.sa-search-input');

    // ── 3. API calls ─────────────────────────────────────────
    async function fetchAccounts() {
      var response = await fetch(ACCOUNTS_API, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });

      if (window.PERSYSApiErrors && (response.status === 401 || response.status === 403 || response.status >= 500)) {
        var checked = await window.PERSYSApiErrors.handleResponse(response);
        if (!checked) return [];
      }

      var result = await response.json();
      if (!response.ok || !result || !result.success || !result.data || !Array.isArray(result.data.accounts)) {
        throw new Error((result && result.message) || 'Unable to load accounts.');
      }

      return result.data.accounts;
    }

    async function requestSwitch(view) {
      var response = await fetch(SWITCH_API, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ view: view })
      });

      var result = await response.json();
      if (!response.ok || !result || !result.success) {
        throw new Error((result && result.message) || 'Unable to switch accounts.');
      }

      return result;
    }

    // ── 4. Rendering ─────────────────────────────────────────
    function initials(name) {
      var parts = String(name).trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return 'A';
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function render(accounts) {
      listEl.replaceChildren();
      emptyEl.textContent = 'No accounts found';

      accounts.forEach(function (acc) {
        var label = acc.label ? (acc.name + ' - ' + acc.label) : acc.name;

        var li = document.createElement('li');
        li.className = 'sa-account-item';
        li.dataset.search = label.toLowerCase();

        var avatar = document.createElement('span');
        avatar.className = 'sa-avatar';
        avatar.setAttribute('aria-hidden', 'true');
        avatar.textContent = initials(acc.name);

        var text = document.createElement('span');
        text.className = 'sa-account-label';
        text.textContent = label;
        text.title = label;

        li.append(avatar, text);

        if (acc.is_current) {
          li.insertAdjacentHTML(
            'beforeend',
            '<svg class="sa-active-check" viewBox="0 0 24 24" role="img" aria-label="Current account">' +
              '<polyline points="20 6 9 17 4 12"/></svg>'
          );
        } else {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'sa-switch-btn';
          btn.textContent = 'Switch';
          btn.setAttribute('aria-label', 'Switch to ' + label);
          btn.addEventListener('click', function () { doSwitch(acc.view, btn); });
          li.appendChild(btn);
        }

        listEl.appendChild(li);
      });

      filter(searchEl.value);
    }

    function filter(query) {
      var q = String(query || '').trim().toLowerCase();
      var visible = 0;
      listEl.querySelectorAll('.sa-account-item').forEach(function (li) {
        var match = !q || li.dataset.search.indexOf(q) !== -1;
        li.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      emptyEl.style.display = visible ? 'none' : 'block';
    }

    function resolveRedirectUrl(redirectPath, view) {
      if (redirectPath) {
        var resolved = String(redirectPath);
        if (window.PERSYS_CONFIG && !window.PERSYS_CONFIG.isLocal) {
          resolved = resolved.replace(/^\/PERSYS-FRONTEND(?=\/|$)/, '');
        }
        return resolved;
      }

      var base = window.PERSYS_CONFIG ? window.PERSYS_CONFIG.FRONTEND_BASE_URL : '';
      return base + (view === 'user'
        ? '/Pages/Users/userDashboard.html'
        : '/Pages/Admin/adminDashboard.html');
    }

    async function doSwitch(view, btn) {
      btn.disabled = true;
      btn.textContent = 'Switching...';

      try {
        var result = await requestSwitch(view);
        window.location.assign(resolveRedirectUrl(result && result.redirect, view));
      } catch (err) {
        console.error('Switch account failed:', err);
        btn.disabled = false;
        btn.textContent = 'Switch';
        alert(err.message || 'Unable to switch account. Please try again.');
      }
    }

    function loadAndRender() {
      return fetchAccounts()
        .then(render)
        .catch(function (err) {
          console.error('Load switch accounts failed:', err);
          listEl.replaceChildren();
          emptyEl.textContent = 'Unable to load accounts.';
          emptyEl.style.display = 'block';
        });
    }

    // ── 5. Open / close / position ───────────────────────────
    function position() {
      var r = toggle.getBoundingClientRect();
      var sidebarRect = sidebar.getBoundingClientRect();
      var width = dropdown.offsetWidth;
      var left = r.right + 8;

      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, Math.min(sidebarRect.left + 8, window.innerWidth - width - 8));
        dropdown.style.top = (r.bottom + 6) + 'px';
      } else {
        dropdown.style.top = Math.max(8, r.top - 6) + 'px';
      }
      dropdown.style.left = left + 'px';
    }

    function open() {
      loadAndRender();
      dropdown.classList.add('is-visible');
      toggle.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      position();
      setTimeout(function () { searchEl.focus(); }, 30);
    }

    function close() {
      if (!dropdown.classList.contains('is-visible')) return;
      dropdown.classList.remove('is-visible');
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      searchEl.value = '';
    }

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.contains('is-visible') ? close() : open();
    });

    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target) && !toggle.contains(e.target)) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dropdown.classList.contains('is-visible')) {
        e.stopPropagation();
        close();
        toggle.focus();
      }
    });

    searchEl.addEventListener('input', function () { filter(this.value); });

    window.addEventListener('resize', close);
    sidebar.addEventListener('scroll', close);

    // Pre-render so the list is ready on first open.
    loadAndRender();
  }

  init();
})();
