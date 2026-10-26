document.addEventListener("DOMContentLoaded", async () => {
    const authorized = await window.PERSYSAdminGuard.ready;

    if (!authorized) {
        return;
    }

    const API_URL =
        `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/profile.php`;

    // Find an element using its ID.
    const byId = (id) => document.getElementById(id);

    // Safely display text without interpreting it as HTML.
    function setText(id, value, fallback = "—") {
        const element = byId(id);

        if (!element) {
            console.warn(`Profile element not found: #${id}`);
            return;
        }

        element.textContent =
            value === null || value === undefined || value === ""
                ? fallback
                : String(value);
    }

    // Format database dates as MM/DD/YY.
    function formatDate(value) {
        if (!value) {
            return "None";
        }

        const parts = String(value).split("-");

        if (parts.length !== 3) {
            return value;
        }

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
        } catch (error) {
        window.PERSYSApiErrors.handleNetworkError(error);
        return;
        }

        const checkedResponse =
        await window.PERSYSApiErrors.handleResponse(response);

        if (!checkedResponse) {
        return;
        }

        const result = await checkedResponse.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Unable to load profile information."
            );
        }

        const profile = result.data.profile;

        // Personal Information
        setText("profileLastName", profile.last_name);
        setText("profileFirstName", profile.first_name);
        setText("profileMiddleName", profile.middle_name);

        // Employee Information
        setText("profilePlantillaItem", profile.plantilla_item_number);
        setText("profilePosition", profile.position);
        setText("profileSalaryGrade", profile.salary_grade);
        setText("profileStepIncrement", profile.step_increment);
        setText("profileAppointmentDate",formatDate(profile.date_original_appointment)
);
        setText(
            "profileLastPromotion",
            formatDate(profile.date_last_promotion)
        );
        setText("profileEmployeeNumber", profile.employee_number);

        // Account Information
        setText("profileDepEdEmail", profile.deped_email);
        setText("profileUsername", profile.username);

        // Sidebar information
        setText("profileSidebarName", profile.username);
        setText("profileSidebarRole", profile.role_name);

        
        // Premium profile banner
        const fullName = [
            profile.first_name,
            profile.middle_name,
            profile.last_name
        ]
            .filter(value => value && String(value).trim())
            .join(" ");

        setText("profileFullName", fullName);
        setText("profileHeroPosition", profile.position);
        setText("profileAccountRole", profile.role_name);

        // Avatar initials
        const initials = [
            profile.first_name,
            profile.last_name
        ]
            .filter(Boolean)
            .map(name => String(name).trim().charAt(0).toUpperCase())
            .join("");

        setText("profileAvatarInitials", initials || "A");

        // Account status is displayed only when provided by the API.
        const statusElement = byId("profileAccountStatus");

        if (statusElement) {
            const rawStatus = profile.is_active;

            statusElement.classList.remove(
                "is-active",
                "is-inactive"
            );

            if (rawStatus === 1 || rawStatus === "1" ||
                rawStatus === true) {
                statusElement.textContent = "Active";
                statusElement.classList.add("is-active");
            } else if (rawStatus === 0 || rawStatus === "0" ||
                       rawStatus === false) {
                statusElement.textContent = "Inactive";
                statusElement.classList.add("is-inactive");
            } else {
                statusElement.textContent = "Not available";
            }
        }


        // // Never expose or attempt to retrieve the stored password hash.
        // const passwordElement = byId("profilePasswordValue");

        // if (passwordElement) {
        //     passwordElement.textContent = "••••••••";
        //     passwordElement.removeAttribute("data-password");
        // }

        // Password visibility must never reveal a real password or hash.
        const passwordToggle = byId("profilePasswordToggle");

        if (passwordToggle && passwordElement) {
            passwordToggle.addEventListener("click", () => {
                passwordElement.textContent = "••••••••";
                passwordToggle.setAttribute("aria-pressed", "false");
                passwordToggle.setAttribute(
                    "aria-label",
                    "Password is hidden. Use Change Password to update it."
                );
            });
        }

        console.log("Admin profile loaded successfully.");

    } catch (error) {
        console.error("Admin profile loading error:", error);

        const message =
            error.message === "Failed to fetch"
                ? "Unable to connect to the profile API. Check XAMPP and the API URL."
                : error.message;

        // Show an error in the page if an error message element exists.
        const errorElement = byId("profileError");

        if (errorElement) {
            errorElement.textContent = message;
            errorElement.hidden = false;
        } else {
            alert(message);
        }
    }
});
