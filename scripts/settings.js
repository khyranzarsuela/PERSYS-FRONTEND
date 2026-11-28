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
      initAdminSystemJobsAndScheduler();
    });
  } else {
    syncSettingsPageControls();
    populateSettingsSidebarProfile();
    initAdminSystemJobsAndScheduler();
  }

  /* =====================================================================
     ADMIN SYSTEM JOBS & LOGS + BACKGROUND SCHEDULER HEARTBEAT
     ===================================================================== */

  var jobsCurrentPage = 1;

  function initAdminSystemJobsAndScheduler() {
    if (!window.PERSYS_CONFIG || !window.PERSYSAdminGuard) {
      return;
    }

    var jobsApiUrl = window.PERSYS_CONFIG.API_BASE_URL + '/api/admin/jobs.php';

    window.PERSYSAdminGuard.ready.then(function (authorized) {
      if (!authorized) return;

      // Run lightweight background scheduler tick on Admin pages (every 60s)
      triggerBackgroundSchedulerTick(jobsApiUrl);
      setInterval(function () {
        triggerBackgroundSchedulerTick(jobsApiUrl);
      }, 60000);

      // If on Admin Settings page (#systemJobsSection exists), wire System Jobs & Logs UI
      var section = document.getElementById('systemJobsSection');
      if (section) {
        wireSystemJobsSection(jobsApiUrl);
        loadSystemJobsOverview(jobsApiUrl);
      }
    }).catch(function () {
      // Ignore if not on an admin page
    });
  }

  function triggerBackgroundSchedulerTick(jobsApiUrl) {
    fetch(jobsApiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ action: 'tick' })
    }).then(function (res) {
      return res.json().catch(function () { return null; });
    }).then(function (result) {
      if (result && result.success && result.data && Number(result.data.executed_count) > 0) {
        if (document.getElementById('systemJobsSection')) {
          loadSystemJobsOverview(jobsApiUrl);
        }
      }
    }).catch(function () {
      // Silent background tick
    });
  }

  function wireSystemJobsSection(jobsApiUrl) {
    var saveRetentionBtn = document.getElementById('saveRetentionDaysBtn');
    var retentionInput   = document.getElementById('archiveRetentionDaysInput');
    var filterJobEl      = document.getElementById('jobLogsFilterJob');
    var filterStatusEl   = document.getElementById('jobLogsFilterStatus');
    var perPageEl        = document.getElementById('jobLogsPerPage');
    var refreshBtn       = document.getElementById('refreshJobLogsBtn');
    var prevBtn          = document.getElementById('jobLogsPrevBtn');
    var nextBtn          = document.getElementById('jobLogsNextBtn');
    var syncCalNowBtn    = document.getElementById('btnSyncGoogleCalendarNow');

    if (syncCalNowBtn) {
      syncCalNowBtn.addEventListener('click', function () {
        var calSyncUrl = window.PERSYS_CONFIG.API_BASE_URL + '/api/admin/calendarSync.php';
        syncCalNowBtn.disabled = true;
        syncCalNowBtn.textContent = 'Syncing...';

        fetch(calSyncUrl, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          }
        })
          .then(function (res) { return res.json(); })
          .then(function (result) {
            var isErr = !result || !result.success;
            var msg = (result && result.message) || 'Google Calendar sync finished.';
            showJobFeedback('[Google Calendar Sync] ' + msg, isErr);
            jobsCurrentPage = 1;
            loadSystemJobsOverview(jobsApiUrl);
          })
          .catch(function (err) {
            showJobFeedback('[Google Calendar Sync] Failed: ' + (err.message || 'Network error'), true);
          })
          .finally(function () {
            syncCalNowBtn.disabled = false;
            syncCalNowBtn.textContent = 'Sync Calendar Now';
          });
      });
    }

    if (saveRetentionBtn && retentionInput) {
      saveRetentionBtn.addEventListener('click', function () {
        var rawDays = Number(retentionInput.value);
        if (!Number.isFinite(rawDays) || rawDays < 0 || rawDays > 3650) {
          showJobFeedback('Please enter a valid retention window between 0 and 3,650 days.', true);
          return;
        }

        saveRetentionBtn.disabled = true;
        saveRetentionBtn.textContent = 'Saving...';

        fetch(jobsApiUrl, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            action: 'update_settings',
            archive_retention_days: Math.floor(rawDays)
          })
        })
          .then(function (res) { return res.json(); })
          .then(function (result) {
            if (!result || !result.success) {
              throw new Error((result && result.message) || 'Unable to save archive retention setting.');
            }
            retentionInput.value = String(result.data.archive_retention_days);
            showJobFeedback(result.message || 'Archive retention window updated.', false);
          })
          .catch(function (err) {
            showJobFeedback(err.message || 'Unable to save archive retention setting.', true);
          })
          .finally(function () {
            saveRetentionBtn.disabled = false;
            saveRetentionBtn.textContent = 'Save Retention';
          });
      });
    }

    if (filterJobEl) {
      filterJobEl.addEventListener('change', function () {
        jobsCurrentPage = 1;
        loadSystemJobsOverview(jobsApiUrl);
      });
    }

    if (filterStatusEl) {
      filterStatusEl.addEventListener('change', function () {
        jobsCurrentPage = 1;
        loadSystemJobsOverview(jobsApiUrl);
      });
    }

    if (perPageEl) {
      perPageEl.addEventListener('change', function () {
        jobsCurrentPage = 1;
        loadSystemJobsOverview(jobsApiUrl);
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        loadSystemJobsOverview(jobsApiUrl);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (jobsCurrentPage > 1) {
          jobsCurrentPage--;
          loadSystemJobsOverview(jobsApiUrl);
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        jobsCurrentPage++;
        loadSystemJobsOverview(jobsApiUrl);
      });
    }
  }

  function showJobFeedback(message, isError) {
    var banner = document.getElementById('jobRunFeedbackBanner');
    if (!banner) return;
    banner.hidden = false;
    banner.textContent = message;
    banner.className = 'job-run-feedback ' + (isError ? 'is-error' : 'is-success');
  }

  function loadSystemJobsOverview(jobsApiUrl) {
    var jobFilter = (document.getElementById('jobLogsFilterJob') || {}).value || 'all';
    var statusFilter = (document.getElementById('jobLogsFilterStatus') || {}).value || 'all';
    var perPage = Number((document.getElementById('jobLogsPerPage') || {}).value) || 10;

    var params = new URLSearchParams({
      page: String(jobsCurrentPage),
      per_page: String(perPage),
      job_name: jobFilter,
      status: statusFilter
    });

    fetch(jobsApiUrl + '?' + params.toString(), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    })
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (!result || !result.success || !result.data) {
          throw new Error((result && result.message) || 'Unable to load system jobs.');
        }

        var data = result.data;
        var retentionInput = document.getElementById('archiveRetentionDaysInput');
        if (retentionInput && document.activeElement !== retentionInput) {
          retentionInput.value = String(data.archive_retention_days ?? 90);
        }

        var eqPill = document.getElementById('emailQueueSummaryPill');
        if (eqPill && data.email_queue_stats) {
          var q = data.email_queue_stats;
          eqPill.textContent =
            'Email Queue: ' + (q.pending || 0) + ' Pending • ' + (q.sent || 0) + ' Sent • ' + (q.failed || 0) + ' Failed';
        }

        var bkPill = document.getElementById('dbBackupsSummaryPill');
        if (bkPill) {
          bkPill.textContent = 'SQL Backups: ' + (data.backup_files_count ?? 0) + ' / 30';
        }

        var gcalPill = document.getElementById('gcalQueueSummaryPill');
        var gcalDetail = document.getElementById('gcalSyncDetailText');
        if (data.calendar_sync_status) {
          var cs = data.calendar_sync_status;
          var pnd = Number(cs.pending_count || 0);
          var fld = Number(cs.failed_count || 0);
          var snc = Number(cs.synced_count || 0);
          var stateLbl = !cs.enabled
            ? 'Disabled'
            : (pnd > 0 ? (pnd + ' Pending') : 'Synced');

          if (gcalPill) {
            gcalPill.textContent =
              'Google Calendar: ' + stateLbl + ' • ' + pnd + ' Pending • ' + snc + ' Synced';
          }
          if (gcalDetail) {
            var lastSyncFmt = cs.last_synced_at ? formatJobDateTime(cs.last_synced_at) : 'No sync recorded yet';
            gcalDetail.textContent =
              'Status: ' + (cs.configured ? 'Connected (Service Account)' : (cs.enabled ? 'Offline Fallback (Key Missing)' : 'Disabled in .env')) +
              ' • Pending Queue: ' + pnd +
              ' • Failed: ' + fld +
              ' • Total Synced: ' + snc +
              ' • Last Synced: ' + lastSyncFmt;
          }
        }

        renderScheduledJobsTable(data.jobs || [], jobsApiUrl);
        renderJobExecutionLogsTable(data.logs || {});
      })
      .catch(function (err) {
        console.error('System jobs load error:', err);
      });
  }

  function renderScheduledJobsTable(jobs, jobsApiUrl) {
    var tbody = document.getElementById('scheduledJobsTableBody');
    if (!tbody) return;
    tbody.replaceChildren();

    if (!jobs.length) {
      var trEmpty = document.createElement('tr');
      var tdEmpty = document.createElement('td');
      tdEmpty.colSpan = 6;
      tdEmpty.className = 'jobs-empty-cell';
      tdEmpty.textContent = 'No scheduled jobs registered.';
      trEmpty.appendChild(tdEmpty);
      tbody.appendChild(trEmpty);
      return;
    }

    jobs.forEach(function (job) {
      var tr = document.createElement('tr');

      // Col 1: Job Name & Description
      var tdName = document.createElement('td');
      var titleSpan = document.createElement('span');
      titleSpan.className = 'job-name-primary';
      titleSpan.textContent = job.display_name || job.job_name;
      var descSpan = document.createElement('span');
      descSpan.className = 'job-name-desc';
      descSpan.textContent = job.description || '';
      tdName.append(titleSpan, descSpan);

      // Col 2: Schedule
      var tdSched = document.createElement('td');
      var schedPill = document.createElement('span');
      schedPill.className = 'job-schedule-pill';
      schedPill.textContent = job.schedule || '—';
      tdSched.appendChild(schedPill);

      // Col 3: Last Run Time
      var tdLastRun = document.createElement('td');
      tdLastRun.textContent = job.last_run_time ? formatJobDateTime(job.last_run_time) : 'Never run';

      // Col 4: Last Status
      var tdStatus = document.createElement('td');
      var stLow = String(job.last_status || 'never').toLowerCase();
      var stPill = document.createElement('span');
      stPill.className = 'job-status-pill status-' + stLow;
      stPill.textContent = job.last_status ? job.last_status.toUpperCase() : 'NEVER';
      tdStatus.appendChild(stPill);

      // Col 5: Records Processed
      var tdRecs = document.createElement('td');
      tdRecs.style.fontWeight = '700';
      tdRecs.textContent = job.records_processed !== null && job.records_processed !== undefined
        ? String(job.records_processed)
        : '—';

      // Col 6: Manual "Run Now" Button
      var tdAction = document.createElement('td');
      var runBtn = document.createElement('button');
      runBtn.type = 'button';
      runBtn.className = 'btn-run-job-now';
      runBtn.textContent = '▶ Run Now';
      runBtn.addEventListener('click', function () {
        executeManualJobRun(job.job_name, job.display_name || job.job_name, runBtn, jobsApiUrl);
      });
      tdAction.appendChild(runBtn);

      tr.append(tdName, tdSched, tdLastRun, tdStatus, tdRecs, tdAction);
      tbody.appendChild(tr);
    });
  }

  function executeManualJobRun(jobName, displayName, triggerBtn, jobsApiUrl) {
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = 'Running...';
    }

    fetch(jobsApiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        action: 'run_now',
        job_name: jobName
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (result) {
        var runRes = (result && result.data && result.data.run_result) || null;
        var isErr = !result || !result.success || (runRes && runRes.status === 'failed');
        var msg = (runRes && runRes.message) || (result && result.message) || ('Executed ' + displayName);
        showJobFeedback('[' + displayName + '] ' + msg, isErr);
        jobsCurrentPage = 1;
        loadSystemJobsOverview(jobsApiUrl);
      })
      .catch(function (err) {
        showJobFeedback('[' + displayName + '] Failed to run job: ' + (err.message || 'Network error'), true);
      })
      .finally(function () {
        if (triggerBtn) {
          triggerBtn.disabled = false;
          triggerBtn.textContent = '▶ Run Now';
        }
      });
  }

  function renderJobExecutionLogsTable(logsData) {
    var tbody = document.getElementById('jobLogsTableBody');
    var pagBar = document.getElementById('jobLogsPaginationBar');
    var pageInfo = document.getElementById('jobLogsPageInfo');
    var pageNum = document.getElementById('jobLogsPageNum');
    var prevBtn = document.getElementById('jobLogsPrevBtn');
    var nextBtn = document.getElementById('jobLogsNextBtn');

    if (!tbody) return;
    tbody.replaceChildren();

    var items = Array.isArray(logsData.items) ? logsData.items : [];
    var total = Number(logsData.total || 0);
    var page = Number(logsData.page || 1);
    var perPage = Number(logsData.per_page || 10);
    var totalPages = Number(logsData.total_pages || 1);
    jobsCurrentPage = page;

    if (!items.length) {
      var trEmpty = document.createElement('tr');
      var tdEmpty = document.createElement('td');
      tdEmpty.colSpan = 6;
      tdEmpty.className = 'jobs-empty-cell';
      tdEmpty.textContent = 'No job execution logs found. Click "Run Now" on any job above to test and generate a log entry.';
      trEmpty.appendChild(tdEmpty);
      tbody.appendChild(trEmpty);
      if (pagBar) pagBar.hidden = true;
      return;
    }

    items.forEach(function (log) {
      var tr = document.createElement('tr');

      // Col 1: Timestamp
      var tdTime = document.createElement('td');
      tdTime.style.whiteSpace = 'nowrap';
      tdTime.textContent = formatJobDateTime(log.finished_at || log.started_at);

      // Col 2: Job Name
      var tdName = document.createElement('td');
      tdName.style.fontWeight = '700';
      tdName.textContent = log.display_name || log.job_name;

      // Col 3: Trigger Type
      var tdTrig = document.createElement('td');
      var trigBadge = document.createElement('span');
      var trigLow = String(log.trigger_type || 'scheduled').toLowerCase();
      trigBadge.className = 'job-trigger-badge trigger-' + trigLow;
      trigBadge.textContent = trigLow;
      tdTrig.appendChild(trigBadge);

      // Col 4: Status Badge
      var tdStatus = document.createElement('td');
      var stLow = String(log.status || 'running').toLowerCase();
      var stPill = document.createElement('span');
      stPill.className = 'job-status-pill status-' + stLow;
      stPill.textContent = stLow.toUpperCase();
      tdStatus.appendChild(stPill);

      // Col 5: Records Processed
      var tdRecs = document.createElement('td');
      tdRecs.style.fontWeight = '700';
      tdRecs.textContent = String(log.records_processed ?? 0);

      // Col 6: Message / Error Details
      var tdMsg = document.createElement('td');
      tdMsg.className = 'job-log-msg-cell';
      tdMsg.textContent = log.message || '—';
      if (log.error_details && log.error_details !== log.message) {
        var errSpan = document.createElement('span');
        errSpan.className = 'job-log-err-detail';
        errSpan.textContent = 'Error: ' + log.error_details;
        tdMsg.appendChild(errSpan);
      }

      tr.append(tdTime, tdName, tdTrig, tdStatus, tdRecs, tdMsg);
      tbody.appendChild(tr);
    });

    if (pagBar) {
      pagBar.hidden = false;
      var startIdx = (page - 1) * perPage + 1;
      var endIdx = Math.min(page * perPage, total);
      if (pageInfo) pageInfo.textContent = 'Showing ' + startIdx + '–' + endIdx + ' of ' + total + ' log(s)';
      if (pageNum) pageNum.textContent = 'Page ' + page + ' of ' + totalPages;
      if (prevBtn) prevBtn.disabled = page <= 1;
      if (nextBtn) nextBtn.disabled = page >= totalPages;
    }
  }

  function formatJobDateTime(raw) {
    if (!raw) return '—';
    var d = new Date(String(raw).replace(' ', 'T'));
    if (isNaN(d.getTime())) return String(raw);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

})();
