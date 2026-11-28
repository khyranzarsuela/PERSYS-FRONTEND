/**
 * PERSYS — Login Page · UI Interactions
 * -------------------------------------------------------
 * Scope: client-side UI and form processing.
 * -------------------------------------------------------
 */

(function () {
  'use strict';

  // Apply saved theme cookie (light / dark) on the Login page as well
  try {
    const cookieMatch = (document.cookie || '').match(/(?:^|;\s*)persysTheme=([^;]+)/);
    if (cookieMatch && decodeURIComponent(cookieMatch[1]) === 'dark') {
      document.documentElement.dataset.theme = 'dark';
    }
  } catch (e) {
    // Ignore cookie read issues
  }

  // ── Element references ──────────────────────────────────
  const loginForm      = document.getElementById('loginForm');
  const loginInput     = document.getElementById('login');
  const loginGroup     = document.getElementById('loginGroup');
  const loginError     = document.getElementById('loginError');

  const passwordInput  = document.getElementById('password');
  const passwordGroup  = document.getElementById('passwordGroup');
  const passwordError  = document.getElementById('passwordError');

  const togglePassword = document.getElementById('togglePassword');
  const loginMessageEl = document.getElementById('loginMessage');

  // Show toast/banner if redirected after password change in Settings
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('password_updated') === '1' && loginMessageEl) {
      loginMessageEl.textContent = 'Password updated. Please log in again.';
      loginMessageEl.classList.add('is-success');
      loginMessageEl.hidden = false;
      urlParams.delete('password_updated');
      const cleanSearch = urlParams.toString();
      const cleanUrl = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '') + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  } catch (e) {
    // Ignore URLSearchParams errors
  }

  // Exit safely if the form is missing on this specific page load
  if (!loginForm) return;

  // ── 1. SHOW / HIDE PASSWORD ────────────────────────────
  if (togglePassword) {
    togglePassword.addEventListener('click', function () {
      const isHidden = passwordInput.type === 'password';

      passwordInput.type = isHidden ? 'text' : 'password';

      this.classList.toggle('is-visible', isHidden);
      this.setAttribute('aria-pressed', String(isHidden));

      passwordInput.focus();
    });
  }

  // ── 2. VALIDATION HELPERS ─────────────────────────────

  function showError(group, errorEl, message) {
    group.classList.add('has-error');
    errorEl.textContent = message;
  }

  function clearError(group, errorEl) {
    group.classList.remove('has-error');
    errorEl.textContent = '';
  }

  // ── 3. REAL-TIME VALIDATION (on blur) ──────────────────

  /*
   * Login can be either:
   * - Email
   * - Username
   *
   * Therefore, we only require that the field
   * contains a value.
   */
  loginInput.addEventListener('blur', function () {
    const val = this.value.trim();

    if (val === '') {
      showError(
        loginGroup,
        loginError,
        'Email or username is required.'
      );
    } else {
      clearError(loginGroup, loginError);
    }
  });

  loginInput.addEventListener('input', function () {
    if (loginGroup.classList.contains('has-error')) {
      const val = this.value.trim();

      if (val !== '') {
        clearError(loginGroup, loginError);
      }
    }
  });

  // ── PASSWORD VALIDATION ────────────────────────────────

  passwordInput.addEventListener('blur', function () {
    if (this.value === '') {
      showError(
        passwordGroup,
        passwordError,
        'Password is required.'
      );
    } else if (this.value.length < 6) {
      showError(
        passwordGroup,
        passwordError,
        'Password must be at least 6 characters.'
      );
    } else {
      clearError(passwordGroup, passwordError);
    }
  });

  passwordInput.addEventListener('input', function () {
    if (
      passwordGroup.classList.contains('has-error') &&
      this.value.length >= 6
    ) {
      clearError(passwordGroup, passwordError);
    }
  });

  // ── 4. SUBMIT VALIDATION ───────────────────────────────

  //HTTP REQUEST SUBMIT
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const loginVal = loginInput.value.trim();
    let isValid = true;

    const loginMessage = document.getElementById('loginMessage');

    if (loginMessage) {
      loginMessage.hidden = true;
      loginMessage.classList.remove('is-success');
      loginMessage.textContent = '';
    }

    if (loginVal === '') {
      showError(
        loginGroup,
        loginError,
        'Email or username is required.'
      );
      isValid = false;
    } else {
      clearError(loginGroup, loginError);
    }

    if (passwordInput.value === '') {
      showError(
        passwordGroup,
        passwordError,
        'Password is required.'
      );
      isValid = false;
    } else if (passwordInput.value.length < 6) {
      showError(
        passwordGroup,
        passwordError,
        'Password must be at least 6 characters.'
      );
      isValid = false;
    } else {
      clearError(passwordGroup, passwordError);
    }

    if (!isValid) {
      const firstError =
        loginForm.querySelector('.has-error .field-input');

      if (firstError) firstError.focus();
      return;
    }

    const submitButton = loginForm.querySelector(
      'button[type="submit"], input[type="submit"]'
    );

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add('is-loading');
      submitButton.dataset.originalText = submitButton.textContent;
      submitButton.textContent = 'Signing in...';
    }

    try {
      const response = await fetch(
          `${window.PERSYS_CONFIG.API_BASE_URL}/api/auth/login.php`,
          {
            method: 'POST',
            body: new FormData(loginForm),
            credentials: 'include',
            headers: {
              'Accept': 'application/json'
            }
          }
        );

      const result = await response.json();

      if (!response.ok || !result.success) {
        if (loginMessage) {
          loginMessage.textContent =
            result.message || 'Login failed. Please try again.';
          loginMessage.hidden = false;
        } else {
          alert(result.message || 'Login failed. Please try again.');
        }

        return;
      }

      if (result.redirect) {
  let redirectPath = result.redirect;

  // Remove the XAMPP frontend prefix for online deployment.
  if (!window.PERSYS_CONFIG.isLocal) {
    redirectPath = redirectPath.replace(
      /^\/PERSYS-FRONTEND(?=\/|$)/,
      ""
    );
  }

  window.location.assign(redirectPath);
}
    } catch (error) {
      if (loginMessage) {
        loginMessage.textContent =
          'Unable to contact the server. Please try again.';
        loginMessage.hidden = false;
      } else {
        alert('Unable to contact the server. Please try again.');
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove('is-loading');
        submitButton.textContent = submitButton.dataset.originalText || 'Login';
      }
    }
  });

})();


/* ==============================================
   PERSYS LOGIN — IMAGE CAROUSEL
   Independent of authentication logic
   ============================================== */

(function () {
    "use strict";

    const carousel = document.getElementById("loginCarousel");

    if (!carousel) return;

    const images = Array.from(
        carousel.querySelectorAll(".carousel-image")
    );

    const dots = Array.from(
        carousel.querySelectorAll(".carousel-dot")
    );

    const pauseButton = document.getElementById("carouselPause");

    if (images.length === 0) return;

    // Change images every 60 seconds.
    const SLIDE_DURATION = 10000;

    let currentIndex = 0;
    let timer = null;
    let isPaused = false;

    const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    );

    function showSlide(index) {
        currentIndex = (index + images.length) % images.length;

        images.forEach((image, i) => {
            image.classList.toggle(
                "is-active",
                i === currentIndex
            );
        });

        dots.forEach((dot, i) => {
            const active = i === currentIndex;

            dot.classList.toggle("is-active", active);

            dot.setAttribute(
                "aria-pressed",
                String(active)
            );
        });
    }

    function stopTimer() {
        if (timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    }

    function startTimer() {
        stopTimer();

        if (isPaused || reduceMotion.matches) return;

        timer = setInterval(() => {
            showSlide(currentIndex + 1);
        }, SLIDE_DURATION);
    }

    // Manual navigation using indicators.
    dots.forEach((dot, index) => {
        dot.addEventListener("click", () => {
            showSlide(index);
            startTimer();
        });
    });

    // Pause / resume.
    if (pauseButton) {
        pauseButton.addEventListener("click", () => {
            isPaused = !isPaused;

            pauseButton.textContent = isPaused
                ? "Play"
                : "Pause";

            pauseButton.setAttribute(
                "aria-pressed",
                String(isPaused)
            );

            pauseButton.setAttribute(
                "aria-label",
                isPaused
                    ? "Resume image carousel"
                    : "Pause image carousel"
            );

            if (isPaused) {
                stopTimer();
            } else {
                startTimer();
            }
        });
    }

    // Stop cycling while the tab is not visible.
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stopTimer();
        } else {
            startTimer();
        }
    });

    // Respect reduced-motion preferences.
    reduceMotion.addEventListener("change", startTimer);

    // Initialize.
    showSlide(0);
    startTimer();
})();


/* ==============================================
   PERSYS LOGIN — FORGOT PASSWORD 3-STEP MODAL
   ============================================== */

(function () {
  'use strict';

  const forgotLink = document.getElementById('forgotPasswordLink');
  const modalOverlay = document.getElementById('forgotPasswordModalOverlay');
  if (!forgotLink || !modalOverlay) return;

  const closeBtn = document.getElementById('fpModalCloseBtn');
  const feedbackEl = document.getElementById('fpModalFeedback');

  const step1Indicator = document.getElementById('fpStepIndicator1');
  const step2Indicator = document.getElementById('fpStepIndicator2');
  const step3Indicator = document.getElementById('fpStepIndicator3');

  const step1Form = document.getElementById('fpStep1Form');
  const step2Form = document.getElementById('fpStep2Form');
  const step3Form = document.getElementById('fpStep3Form');

  const identifierGroup = document.getElementById('fpIdentifierGroup');
  const identifierInput = document.getElementById('fpIdentifierInput');
  const identifierError = document.getElementById('fpIdentifierError');
  const step1SubmitBtn  = document.getElementById('fpStep1SubmitBtn');
  const cancelStep1Btn  = document.getElementById('fpCancelStep1Btn');

  const otpGroup       = document.getElementById('fpOtpGroup');
  const otpInput       = document.getElementById('fpOtpInput');
  const otpError       = document.getElementById('fpOtpError');
  const resendOtpBtn   = document.getElementById('fpResendOtpBtn');
  const backToStep1Btn = document.getElementById('fpBackToStep1Btn');
  const step2SubmitBtn = document.getElementById('fpStep2SubmitBtn');

  const newPwGroup       = document.getElementById('fpNewPasswordGroup');
  const newPwInput       = document.getElementById('fpNewPasswordInput');
  const newPwError       = document.getElementById('fpNewPasswordError');
  const confirmPwGroup   = document.getElementById('fpConfirmPasswordGroup');
  const confirmPwInput   = document.getElementById('fpConfirmPasswordInput');
  const confirmPwError   = document.getElementById('fpConfirmPasswordError');
  const cancelStep3Btn   = document.getElementById('fpCancelStep3Btn');
  const step3SubmitBtn   = document.getElementById('fpStep3SubmitBtn');

  let activeIdentifier = '';
  let activeResetToken = '';
  let resendTimerId    = null;
  let resendRemaining  = 0;

  function setFieldError(group, errEl, msg) {
    if (!group || !errEl) return;
    if (msg) {
      group.classList.add('has-error');
      errEl.textContent = msg;
    } else {
      group.classList.remove('has-error');
      errEl.textContent = '';
    }
  }

  function showModalFeedback(message, type) {
    if (!feedbackEl) return;
    if (!message) {
      feedbackEl.hidden = true;
      feedbackEl.textContent = '';
      feedbackEl.className = 'fp-alert';
      return;
    }
    feedbackEl.hidden = false;
    feedbackEl.textContent = message;
    feedbackEl.className = 'fp-alert ' + (type === 'success' ? 'is-success' : (type === 'info' ? 'is-info' : 'is-error'));
  }

  function clearResendTimer() {
    if (resendTimerId !== null) {
      clearInterval(resendTimerId);
      resendTimerId = null;
    }
  }

  function startResendCooldown(seconds) {
    clearResendTimer();
    resendRemaining = Math.max(0, Math.ceil(Number(seconds) || 60));

    function updateBtn() {
      if (!resendOtpBtn) return;
      if (resendRemaining > 0) {
        resendOtpBtn.disabled = true;
        resendOtpBtn.textContent = 'Resend in ' + resendRemaining + 's';
      } else {
        resendOtpBtn.disabled = false;
        resendOtpBtn.textContent = 'Resend Code';
      }
    }

    updateBtn();
    if (resendRemaining <= 0) return;

    resendTimerId = setInterval(function () {
      resendRemaining -= 1;
      if (resendRemaining <= 0) {
        resendRemaining = 0;
        clearResendTimer();
      }
      updateBtn();
    }, 1000);
  }

  function goToStep(stepNumber) {
    step1Form.hidden = stepNumber !== 1;
    step2Form.hidden = stepNumber !== 2;
    step3Form.hidden = stepNumber !== 3;

    step1Indicator.classList.toggle('is-active', stepNumber === 1);
    step1Indicator.classList.toggle('is-done', stepNumber > 1);

    step2Indicator.classList.toggle('is-active', stepNumber === 2);
    step2Indicator.classList.toggle('is-done', stepNumber > 2);

    step3Indicator.classList.toggle('is-active', stepNumber === 3);
    step3Indicator.classList.toggle('is-done', false);

    setFieldError(identifierGroup, identifierError, '');
    setFieldError(otpGroup, otpError, '');
    setFieldError(newPwGroup, newPwError, '');
    setFieldError(confirmPwGroup, confirmPwError, '');

    if (stepNumber === 1 && identifierInput) {
      setTimeout(function () { identifierInput.focus(); }, 30);
    } else if (stepNumber === 2 && otpInput) {
      setTimeout(function () { otpInput.focus(); }, 30);
    } else if (stepNumber === 3 && newPwInput) {
      setTimeout(function () { newPwInput.focus(); }, 30);
    }
  }

  function openForgotModal() {
    activeIdentifier = '';
    activeResetToken = '';
    clearResendTimer();
    showModalFeedback('', '');

    step1Form.reset();
    step2Form.reset();
    step3Form.reset();

    // Reset password visibility states in step 3
    modalOverlay.querySelectorAll('.fp-toggle-pw').forEach(function (btn) {
      btn.classList.remove('is-visible');
      btn.setAttribute('aria-pressed', 'false');
      const targetId = btn.getAttribute('data-target');
      const input = targetId ? document.getElementById(targetId) : null;
      if (input) input.type = 'password';
    });

    const loginInput = document.getElementById('login');
    if (loginInput && loginInput.value.trim() !== '') {
      identifierInput.value = loginInput.value.trim();
    }

    modalOverlay.hidden = false;
    goToStep(1);
  }

  function closeForgotModal() {
    clearResendTimer();
    modalOverlay.hidden = true;
  }

  forgotLink.addEventListener('click', function (e) {
    e.preventDefault();
    openForgotModal();
  });

  if (closeBtn) closeBtn.addEventListener('click', closeForgotModal);
  if (cancelStep1Btn) cancelStep1Btn.addEventListener('click', closeForgotModal);
  if (cancelStep3Btn) cancelStep3Btn.addEventListener('click', closeForgotModal);

  if (backToStep1Btn) {
    backToStep1Btn.addEventListener('click', function () {
      showModalFeedback('', '');
      goToStep(1);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modalOverlay.hidden) {
      closeForgotModal();
    }
  });

  // Wire show/hide password toggles in Step 3
  modalOverlay.querySelectorAll('.fp-toggle-pw').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const targetId = this.getAttribute('data-target');
      const input = targetId ? document.getElementById(targetId) : null;
      if (!input) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      this.classList.toggle('is-visible', isHidden);
      this.setAttribute('aria-pressed', String(isHidden));
      input.focus();
    });
  });

  // Restrict OTP input to digits only
  if (otpInput) {
    otpInput.addEventListener('input', function () {
      this.value = this.value.replace(/\D+/g, '').slice(0, 6);
      if (this.value.length > 0) {
        setFieldError(otpGroup, otpError, '');
      }
    });
  }

  // ── STEP 1: Request OTP ──────────────────────────────────
  async function requestOtpForIdentifier(identifier, triggerBtn, loadingLabel, defaultLabel) {
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = loadingLabel;
    }

    try {
      const response = await fetch(
        `${window.PERSYS_CONFIG.API_BASE_URL}/api/auth/forgotPasswordRequestOtp.php`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ identifier: identifier })
        }
      );

      const result = await response.json().catch(function () { return null; });

      if (!response.ok || !result || !result.success) {
        const msg = (result && result.message) || 'Unable to send verification code. Please try again.';
        showModalFeedback(msg, 'error');
        const retryAfter = result && (result.retry_after || (result.data && result.data.retry_after));
        if (retryAfter) {
          startResendCooldown(retryAfter);
        }
        return false;
      }

      activeIdentifier = identifier;
      const cooldown = (result && (result.cooldown_seconds || (result.data && result.data.cooldown_seconds))) || 60;
      startResendCooldown(cooldown);
      goToStep(2);
      showModalFeedback(
        result.message || 'If an active account matches that identifier, a 6-digit verification code has been sent to its registered email address.',
        'info'
      );
      return true;
    } catch (err) {
      showModalFeedback(
        'Unable to reach the server. If you are offline, please contact your System Administrator to reset your password.',
        'error'
      );
      return false;
    } finally {
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.textContent = defaultLabel;
      }
    }
  }

  step1Form.addEventListener('submit', async function (e) {
    e.preventDefault();
    showModalFeedback('', '');

    const val = identifierInput.value.trim();
    if (val === '') {
      setFieldError(identifierGroup, identifierError, 'Please enter your email or username.');
      identifierInput.focus();
      return;
    }
    setFieldError(identifierGroup, identifierError, '');

    await requestOtpForIdentifier(val, step1SubmitBtn, 'Sending Code...', 'Send Verification Code');
  });

  if (resendOtpBtn) {
    resendOtpBtn.addEventListener('click', async function () {
      if (!activeIdentifier || resendRemaining > 0) return;
      showModalFeedback('', '');
      otpInput.value = '';
      await requestOtpForIdentifier(activeIdentifier, resendOtpBtn, 'Sending...', 'Resend Code');
    });
  }

  // ── STEP 2: Verify OTP ───────────────────────────────────
  step2Form.addEventListener('submit', async function (e) {
    e.preventDefault();
    showModalFeedback('', '');

    const otpVal = otpInput.value.trim();
    if (!/^\d{6}$/.test(otpVal)) {
      setFieldError(otpGroup, otpError, 'Please enter a valid 6-digit verification code.');
      otpInput.focus();
      return;
    }
    setFieldError(otpGroup, otpError, '');

    step2SubmitBtn.disabled = true;
    step2SubmitBtn.textContent = 'Verifying...';

    try {
      const response = await fetch(
        `${window.PERSYS_CONFIG.API_BASE_URL}/api/auth/forgotPasswordVerifyOtp.php`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            identifier: activeIdentifier,
            otp: otpVal
          })
        }
      );

      const result = await response.json().catch(function () { return null; });
      const issuedResetToken =
        (result && (result.reset_token || (result.data && result.data.reset_token))) || '';

      if (!response.ok || !result || !result.success || !issuedResetToken) {
        const msg = (result && result.message) || 'Invalid or expired verification code.';
        showModalFeedback(msg, 'error');
        return;
      }

      activeResetToken = issuedResetToken;
      clearResendTimer();
      goToStep(3);
      showModalFeedback('Verification code confirmed. Please enter your new password within 5 minutes.', 'success');
    } catch (err) {
      showModalFeedback('Unable to contact the server. Please try again.', 'error');
    } finally {
      step2SubmitBtn.disabled = false;
      step2SubmitBtn.textContent = 'Verify Code';
    }
  });

  // ── STEP 3: Reset Password ───────────────────────────────
  step3Form.addEventListener('submit', async function (e) {
    e.preventDefault();
    showModalFeedback('', '');

    const newPassword = newPwInput.value;
    const confirmPassword = confirmPwInput.value;
    let valid = true;

    if (newPassword.length < 8) {
      setFieldError(newPwGroup, newPwError, 'New password must be at least 8 characters long.');
      valid = false;
    } else {
      setFieldError(newPwGroup, newPwError, '');
    }

    if (confirmPassword === '') {
      setFieldError(confirmPwGroup, confirmPwError, 'Please confirm your new password.');
      valid = false;
    } else if (newPassword !== confirmPassword) {
      setFieldError(confirmPwGroup, confirmPwError, 'New password and confirmation password do not match.');
      valid = false;
    } else {
      setFieldError(confirmPwGroup, confirmPwError, '');
    }

    if (!valid) return;

    step3SubmitBtn.disabled = true;
    step3SubmitBtn.textContent = 'Resetting Password...';

    try {
      const response = await fetch(
        `${window.PERSYS_CONFIG.API_BASE_URL}/api/auth/forgotPasswordReset.php`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            identifier: activeIdentifier,
            reset_token: activeResetToken,
            new_password: newPassword,
            confirm_password: confirmPassword
          })
        }
      );

      const result = await response.json().catch(function () { return null; });

      if (!response.ok || !result || !result.success) {
        const msg = (result && result.message) || 'Unable to reset password. Please try again.';
        showModalFeedback(msg, 'error');
        return;
      }

      closeForgotModal();

      const loginInput = document.getElementById('login');
      const passwordInput = document.getElementById('password');
      const loginMessage = document.getElementById('loginMessage');

      if (loginInput && activeIdentifier) {
        loginInput.value = activeIdentifier;
      }
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }
      if (loginMessage) {
        loginMessage.textContent = result.message || 'Your password has been reset successfully. You may now log in.';
        loginMessage.classList.add('is-success');
        loginMessage.hidden = false;
      }
    } catch (err) {
      showModalFeedback('Unable to contact the server. Please try again.', 'error');
    } finally {
      step3SubmitBtn.disabled = false;
      step3SubmitBtn.textContent = 'Reset Password';
    }
  });
})();

