/**
 * PERSYS — Login Page · UI Interactions
 * -------------------------------------------------------
 * Scope: client-side UI and form processing.
 * -------------------------------------------------------
 */

(function () {
  'use strict';

  // ── Element references ──────────────────────────────────
  const loginForm      = document.getElementById('loginForm');
  const loginInput     = document.getElementById('login');
  const loginGroup     = document.getElementById('loginGroup');
  const loginError     = document.getElementById('loginError');

  const passwordInput  = document.getElementById('password');
  const passwordGroup  = document.getElementById('passwordGroup');
  const passwordError  = document.getElementById('passwordError');

  const togglePassword = document.getElementById('togglePassword');

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

    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch(
        '/PERSYS-BACKEND/api/auth/login.php',
        {
          method: 'POST',
          body: new FormData(loginForm),
          credentials: 'same-origin',
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
        window.location.assign(result.redirect);
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
      if (submitButton) submitButton.disabled = false;
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
