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
   USER PAGES — jQuery interactions
   All blocks guarded: (1) jQuery exists check, (2) unique
   element exists check so blocks are no-ops on other pages.
   ============================================================ */

/* ── LOGOUT MODAL — present on any page with .btn-logout ──── */
(function () {
  'use strict';
  if (typeof $ === 'undefined') return;
  if (!$('.btn-logout').length) return;

  $('.btn-logout').on('click', function () {
    $('#logoutModal').css('display', 'flex');
  });
  $('#cancelLogoutBtn').on('click', function () {
    $('#logoutModal').hide();
  });
  $('#confirmLogoutBtn').on('click', function () {
    window.location.href = '/PERSYS/Pages/Users/logout.php';
  });
  // Close on overlay click (but not on modal-box click)
  $('#logoutModal').on('click', function (e) {
    if ($(e.target).is('#logoutModal')) $(this).hide();
  });
})();

/* ── REQUEST PAGE — guard: #openLeaveFormBtn ───────────────── */
(function () {
  'use strict';
  if (typeof $ === 'undefined') return;
  if (!$('#openLeaveFormBtn').length) return;

  /** Count weekday (Mon–Fri) days between two date strings inclusive. */
  function countWeekdays(startStr, endStr) {
    var start = new Date(startStr);
    var end   = new Date(endStr);
    if (isNaN(start) || isNaN(end) || end < start) return 0;
    var count = 0;
    var cur = new Date(start);
    while (cur <= end) {
      var day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  /** Recalculate total leave days from current date inputs. */
  function recalcDays() {
    var s = $('#leaveStartDate').val();
    var e = $('#leaveEndDate').val();
    var days = (s && e) ? countWeekdays(s, e) : 0;
    $('#totalLeaveDays').val(days);
  }

  // Open leave form modal
  $('#openLeaveFormBtn').on('click', function () {
    $('#leaveFormModal').css('display', 'flex');
  });

  // Date change → recalculate days
  $('#leaveStartDate, #leaveEndDate').on('change', recalcDays);

  // Cancel on leave form → hide modal
  $('#cancelLeaveFormBtn').on('click', function () {
    $('#leaveFormModal').hide();
  });

  // Review button → validate, populate review modal, show it
  $('#reviewLeaveBtn').on('click', function () {
    var leaveTypeId   = $('#leaveTypeSelect').val();
    var leaveTypeName = $('#leaveTypeSelect option:selected').text();
    var startDate     = $('#leaveStartDate').val();
    var endDate       = $('#leaveEndDate').val();
    var totalDays     = $('#totalLeaveDays').val();
    var reason        = $('#leaveReason').val().trim();

    if (!leaveTypeId || !startDate || !endDate || !reason) {
      alert('Please fill in all required fields.');
      return;
    }
    if (parseInt(totalDays, 10) <= 0) {
      alert('Total leave days must be at least 1 weekday.');
      return;
    }

    // Store for AJAX submit
    $('#leaveFormModal').data('leave-type-id',   leaveTypeId);
    $('#leaveFormModal').data('leave-type-name',  leaveTypeName);
    $('#leaveFormModal').data('start-date',        startDate);
    $('#leaveFormModal').data('end-date',          endDate);
    $('#leaveFormModal').data('total-days',        totalDays);
    $('#leaveFormModal').data('reason',            reason);

    // Populate review display spans
    $('#reviewLeaveType').text(leaveTypeName);
    $('#reviewStartDate').text(startDate);
    $('#reviewEndDate').text(endDate);
    $('#reviewTotalDays').text(totalDays);

    $('#leaveFormModal').hide();
    $('#reviewLeaveModal').css('display', 'flex');
  });

  // Back to edit from review modal
  $('#backToEditBtn').on('click', function () {
    $('#reviewLeaveModal').hide();
    $('#leaveFormModal').css('display', 'flex');
  });

  // Submit leave request via AJAX
  $('#submitLeaveBtn').on('click', function () {
    var $btn = $(this);
    $btn.prop('disabled', true).text('Sending…');

    var data = {
      ajax_submit_leave: 1,
      leave_type_id:    $('#leaveFormModal').data('leave-type-id'),
      start_date:       $('#leaveFormModal').data('start-date'),
      end_date:         $('#leaveFormModal').data('end-date'),
      total_leave_days: $('#leaveFormModal').data('total-days'),
      reason_details:   $('#leaveFormModal').data('reason')
    };

    $.post(window.location.href, data, function (resp) {
      if (resp && resp.success) {
        $('#reviewLeaveModal').hide();
        $('#sentRequestNumber').text(resp.request_number);
        $('#requestSentModal').css('display', 'flex');
      } else {
        alert('Error: ' + (resp.message || 'Could not submit request.'));
        $btn.prop('disabled', false).text('Request and Send');
      }
    }, 'json').fail(function () {
      alert('Server error. Please try again.');
      $btn.prop('disabled', false).text('Request and Send');
    });
  });

  // View request after send → reload page
  $('#viewRequestAfterSend').on('click', function () {
    location.reload();
  });

  // View request details from table row
  $(document).on('click', '.view-request-btn', function (e) {
    e.preventDefault();
    var $row = $(this).closest('tr');
    $('#detailRequestNumber').text($row.data('req-number'));
    $('#detailLeaveType').text($row.data('leave-type'));
    $('#detailStartDate').text($row.data('start'));
    $('#detailEndDate').text($row.data('end'));
    $('#detailTotalDays').text($row.data('days'));

    var status = $row.data('status');
    $('#detailStatus').text(status);
    var note = '';
    if (status === 'Pending')  note = 'Waiting for administrator approval.';
    if (status === 'Approved') note = 'Your leave has been approved.';
    if (status === 'Rejected') note = 'Your leave request was rejected.';
    $('#detailStatusNote').text(note);

    $('#requestDetailsModal').css('display', 'flex');
  });

  // Close request details modal
  $('#closeDetailsBtn').on('click', function () {
    $('#requestDetailsModal').hide();
  });
  $('#requestDetailsModal').on('click', function (e) {
    if ($(e.target).is('#requestDetailsModal')) $(this).hide();
  });

})();

/* ── SETTINGS PAGE — guard: #fontSizeSlider ───────────────── */
// /* ── GLOBAL ACCESSIBILITY SETTINGS ──────────────────────── */
// (function () {
//   'use strict';

//   if (typeof $ === 'undefined') return;

//   // Apply the saved font size on every page.
//   function applyFontSize(size) {
//     var num = parseInt(size, 10);

//     if (isNaN(num) || num < 10 || num > 32) return;

//     document.documentElement.style.setProperty(
//       '--persys-font-size',
//       num + 'px'
//     );
//   }

//   // Restore the saved font size on every page.
//   var savedFontSize = localStorage.getItem('persys_font_size');

//   if (savedFontSize !== null) {
//     applyFontSize(savedFontSize);
//   }

//   // The remaining settings-page controls only run on Settings.
//   if (!$('#fontSizeSlider').length) return;

//   var saveTimer = null;

//   function debounce(fn, delay) {
//     return function () {
//       clearTimeout(saveTimer);
//       saveTimer = setTimeout(fn, delay);
//     };
//   }

//   // Font size slider
//  $('#fontSizeSlider').on('input', function () {
//   var val = $(this).val();

//   $('#fontSizeVal').text(val + 'px');

//   // Save locally so every page can restore the setting.
//   localStorage.setItem('persys_font_size', val);

//   // Apply immediately on the Settings page.
//   applyFontSize(val);

//   // Keep the existing PHP save request.
//   debounce(function () {
//     $.post(window.location.href, {
//       ajax_save_font_size: 1,
//       font_size: val + 'px'
//     });
//   }, 600)();
// });

//   // Brightness slider → localStorage
//   $('#brightnessSlider').on('input', function () {
//     localStorage.setItem('persys_brightness', $(this).val());
//   });

//   // Text spacing slider → localStorage
//   $('#textSpacingSlider').on('input', function () {
//     localStorage.setItem('persys_text_spacing', $(this).val());
//   });

//   // Mode options
//   $('.mode-option').on('click', function () {
//     $('.mode-option').removeClass('selected');
//     $(this).addClass('selected');
//     localStorage.setItem('persys_color_mode', $(this).data('mode'));
//   });

//   // Toggle switches → localStorage
//   $(document).on('change', '.pref-toggle', function () {
//     localStorage.setItem('persys_toggle_' + $(this).attr('id'), $(this).is(':checked') ? '1' : '0');
//   });

//   // Restore all preferences on load
//   $(document).ready(function () {
//     // Font size
//     var fs = localStorage.getItem('persys_font_size');
//     if (fs) {
//       var num = parseInt(fs, 10);
//       if (!isNaN(num)) {
//         $('#fontSizeSlider').val(num);
//         $('#fontSizeVal').text(num + 'px');
//       }
//     }

//     // Brightness
//     var bv = localStorage.getItem('persys_brightness');
//     if (bv !== null) $('#brightnessSlider').val(bv);

//     // Text spacing
//     var ts = localStorage.getItem('persys_text_spacing');
//     if (ts !== null) $('#textSpacingSlider').val(ts);

//     // Mode option
//     var mode = localStorage.getItem('persys_color_mode');
//     if (mode) {
//       $('.mode-option').removeClass('selected');
//       $('.mode-option[data-mode="' + mode + '"]').addClass('selected');
//     }

//     // Toggle switches
//     $('.pref-toggle').each(function () {
//       var stored = localStorage.getItem('persys_toggle_' + $(this).attr('id'));
//       if (stored !== null) $(this).prop('checked', stored === '1');
//     });
//   });

// })();
