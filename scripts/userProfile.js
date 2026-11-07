/* ============================================================
   PERSYS — User Profile
   Fetches data from /api/user/profile.php and populates
   the premium profile hero banner and information panels.
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const authorized = await window.PERSYSUserGuard.ready;

  if (!authorized) {
    return;
  }

  const API_URL =
    `${window.PERSYS_CONFIG.API_BASE_URL}/api/user/profile.php`;

  // Find an element by ID.
  const byId = (id) => document.getElementById(id);

  /**
   * Safely set an element's text content.
   * Uses fallback (default "—") when the value is empty or null.
   */
  function setText(id, value, fallback = "—") {
    const el = byId(id);

    if (!el) {
      console.warn(`Profile element not found: #${id}`);
      return;
    }

    el.textContent =
      value === null || value === undefined || value === ""
        ? fallback
        : String(value);
  }

  /**
   * Format a "YYYY-MM-DD" database date as "MM/DD/YY".
   * Returns "None" for empty/null values.
   */
  function formatDate(value) {
    if (!value) return "None";

    const parts = String(value).split("-");

    if (parts.length !== 3) return value;

    const [year, month, day] = parts;

    return `${month}/${day}/${year.slice(-2)}`;
  }

  try {
    let response;

    try {
      response = await fetch(API_URL, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });
    } catch (networkError) {
      window.PERSYSApiErrors.handleNetworkError(networkError);
      return;
    }

    const checkedResponse =
      await window.PERSYSApiErrors.handleResponse(response);

    if (!checkedResponse) {
      return;
    }

    const result = await checkedResponse.json();

    if (!result.success) {
      throw new Error(result.message || "Unable to load profile information.");
    }

    const profile = result.data.profile;

    // ── Sidebar ─────────────────────────────────────────────
    setText("profileSidebarName", profile.username);
    setText("profileSidebarRole", profile.role_name);

    // ── Hero banner ──────────────────────────────────────────
    const fullName = [profile.first_name, profile.middle_name, profile.last_name]
      .filter((v) => v && String(v).trim())
      .join(" ");

    setText("profileFullName", fullName);
    setText("profileHeroPosition", profile.position);
    setText("profileEmployeeNumber", profile.employee_number);
    setText("profileDepEdEmail", profile.deped_email);

    // Avatar initials from first + last name
    const initials = [profile.first_name, profile.last_name]
      .filter(Boolean)
      .map((name) => String(name).trim().charAt(0).toUpperCase())
      .join("");

    setText("profileAvatarInitials", initials || "U");

    // ── Personal Information panel ───────────────────────────
    setText("profileLastName", profile.last_name);
    setText("profileFirstName", profile.first_name);
    setText("profileMiddleName", profile.middle_name);

    // ── Employee Information panel ───────────────────────────
    setText("profilePlantillaItem", profile.plantilla_item_number);
    setText("profilePosition", profile.position);
    setText("profileSalaryGrade", profile.salary_grade);
    setText("profileStepIncrement", profile.step_increment);
    setText("profileAppointmentDate", formatDate(profile.date_original_appointment));
    setText("profileLastPromotion", formatDate(profile.date_last_promotion));

    // ── Account Information panel ────────────────────────────
    setText("profileDepEdEmailField", profile.deped_email);
    setText("profileUsername", profile.username);
    setText("profileAccountRole", profile.role_name);

  } catch (error) {
    console.error("User profile loading error:", error);

    const message =
      error.message === "Failed to fetch"
        ? "Unable to connect to the profile API. Check XAMPP and the API URL."
        : error.message;

    const errorEl = byId("profileError");

    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    } else {
      alert(message);
    }
  }
});
