/* ============================================================
   PERSYS — Admin Profile & Self-Edit Profile Modal
   Loads and updates the logged-in administrator's own
   Personal Information, Employee Information, and Account Information.
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
    const authorized = await window.PERSYSAdminGuard.ready;
    if (!authorized) {
        return;
    }

    const PROFILE_API_URL =
        `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/profile.php`;
    const UPDATE_PROFILE_API_URL =
        `${window.PERSYS_CONFIG.API_BASE_URL}/api/admin/updateProfile.php`;

    let currentProfileData = null;

    const byId = (id) => document.getElementById(id);

    function setText(id, value, fallback = "—") {
        const element = byId(id);
        if (!element) return;
        element.textContent =
            value === null || value === undefined || value === ""
                ? fallback
                : String(value);
    }

    function formatDate(value) {
        if (!value) {
            return "None";
        }
        const parts = String(value).slice(0, 10).split("-");
        if (parts.length !== 3) {
            return value;
        }
        const [year, month, day] = parts;
        return `${month}/${day}/${year.slice(-2)}`;
    }

    function renderProfileToPage(profile) {
        currentProfileData = profile;

        // Personal Information
        setText("profileLastName", profile.last_name);
        setText("profileFirstName", profile.first_name);
        setText("profileMiddleName", profile.middle_name);

        // Employee Information
        setText("profilePlantillaItem", profile.plantilla_item_number);
        setText("profilePosition", profile.position);
        setText("profileSalaryGrade", profile.salary_grade);
        setText("profileStepIncrement", profile.step_increment);
        setText(
            "profileAppointmentDate",
            formatDate(profile.date_original_appointment)
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

        // Hero Banner
        const fullName = [
            profile.first_name,
            profile.middle_name,
            profile.last_name
        ]
            .filter((value) => value && String(value).trim())
            .join(" ");

        setText("profileFullName", fullName);
        setText("profileHeroPosition", profile.position);
        setText("profileAccountRole", profile.role_name);

        const initials = [profile.first_name, profile.last_name]
            .filter(Boolean)
            .map((name) => String(name).trim().charAt(0).toUpperCase())
            .join("");

        setText("profileAvatarInitials", initials || "A");

        const statusElement = byId("profileAccountStatus");
        if (statusElement) {
            const rawStatus = profile.is_active;
            statusElement.classList.remove("is-active", "is-inactive");

            if (rawStatus === 1 || rawStatus === "1" || rawStatus === true) {
                statusElement.textContent = "Active";
                statusElement.classList.add("is-active");
            } else if (rawStatus === 0 || rawStatus === "0" || rawStatus === false) {
                statusElement.textContent = "Inactive";
                statusElement.classList.add("is-inactive");
            } else {
                statusElement.textContent = "Active";
                statusElement.classList.add("is-active");
            }
        }
    }

    async function loadAdminProfile() {
        try {
            let response;
            try {
                response = await fetch(PROFILE_API_URL, {
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

            renderProfileToPage(result.data.profile);
        } catch (error) {
            console.error("Admin profile loading error:", error);
            const message =
                error.message === "Failed to fetch"
                    ? "Unable to connect to the profile API. Check XAMPP and the API URL."
                    : error.message;

            const errorElement = byId("profileError");
            if (errorElement) {
                errorElement.textContent = message;
                errorElement.hidden = false;
            } else {
                alert(message);
            }
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       EDIT PROFILE MODAL WIRING
    ═══════════════════════════════════════════════════════════════ */

    const modalOverlay = byId("editProfileModalOverlay");
    const editForm = byId("editProfileForm");
    const openBtn = byId("btnOpenEditProfile");
    const closeXBtn = byId("btnCloseEditProfileX");
    const cancelBtn = byId("btnCancelEditProfile");
    const saveBtn = byId("btnSaveEditProfile");
    const noticeEl = byId("editProfileFormNotice");

    function showModalNotice(type, message) {
        if (!noticeEl) return;
        noticeEl.textContent = message;
        noticeEl.className = `profile-modal-notice ${
            type === "success" ? "is-success" : "is-error"
        }`;
        noticeEl.hidden = false;
    }

    function clearModalNotice() {
        if (!noticeEl) return;
        noticeEl.textContent = "";
        noticeEl.hidden = true;
    }

    function openEditProfileModal() {
        if (!currentProfileData || !modalOverlay || !editForm) return;

        editForm.reset();
        clearModalNotice();

        const p = currentProfileData;
        const setVal = (id, val) => {
            const el = byId(id);
            if (el) el.value = val ?? "";
        };

        setVal("ep_last_name", p.last_name);
        setVal("ep_first_name", p.first_name);
        setVal("ep_middle_name", p.middle_name);
        setVal("ep_employee_number", p.employee_number);
        setVal("ep_personnel_type", p.personnel_type || "Teaching");
        setVal("ep_plantilla", p.plantilla_item_number);
        setVal("ep_position", p.position);
        setVal("ep_salary_grade", p.salary_grade);
        setVal("ep_step_increment", p.step_increment);
        setVal(
            "ep_date_orig",
            p.date_original_appointment
                ? String(p.date_original_appointment).slice(0, 10)
                : ""
        );
        setVal(
            "ep_date_promo",
            p.date_last_promotion
                ? String(p.date_last_promotion).slice(0, 10)
                : ""
        );
        setVal("ep_username", p.username);
        setVal("ep_deped_email", p.deped_email);
        setVal("ep_account_role", p.role_name || "Admin");
        setVal(
            "ep_account_status",
            p.is_active === 0 || p.is_active === "0" ? "Inactive" : "Active"
        );
        setVal("ep_new_password", "");
        setVal("ep_confirm_password", "");

        // If Principal has PRINCIPAL_PROFILE_MEDIA_ONLY=true, only Profile Picture & Banner uploads are active
        const flags = window.PERSYSAdminGuard?.getPrincipalFeatures?.() || {};
        const isMediaOnly = Boolean(flags.is_principal && flags.profile_media_only);
        const nonMediaIds = [
            "ep_last_name", "ep_first_name", "ep_middle_name",
            "ep_employee_number", "ep_personnel_type", "ep_plantilla",
            "ep_position", "ep_salary_grade", "ep_step_increment",
            "ep_date_orig", "ep_date_promo",
            "ep_username", "ep_deped_email", "ep_new_password", "ep_confirm_password"
        ];
        nonMediaIds.forEach((id) => {
            const el = byId(id);
            if (el) {
                el.disabled = isMediaOnly;
                el.style.opacity = isMediaOnly ? "0.6" : "";
                el.style.cursor = isMediaOnly ? "not-allowed" : "";
            }
        });
        if (isMediaOnly) {
            showModalNotice(
                "success",
                "Principal Mode: Profile Picture and Banner uploads are active. For personal or employee record changes, please use 'Request Edit Profile' on your Dashboard."
            );
        }

        modalOverlay.hidden = false;
        document.body.style.overflow = "hidden";
        if (!isMediaOnly) {
            byId("ep_last_name")?.focus();
        }
    }

    function closeEditProfileModal() {
        if (!modalOverlay) return;
        modalOverlay.hidden = true;
        document.body.style.overflow = "";
    }

    openBtn?.addEventListener("click", openEditProfileModal);
    closeXBtn?.addEventListener("click", closeEditProfileModal);
    cancelBtn?.addEventListener("click", closeEditProfileModal);

    modalOverlay?.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
            closeEditProfileModal();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modalOverlay && !modalOverlay.hidden) {
            closeEditProfileModal();
        }
    });

    editForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearModalNotice();

        const flags = window.PERSYSAdminGuard?.getPrincipalFeatures?.() || {};
        if (flags.is_principal && flags.profile_media_only) {
            showModalNotice(
                "success",
                "Profile Picture & Banner selections saved (media storage integration is reserved for future update)."
            );
            setTimeout(() => closeEditProfileModal(), 900);
            return;
        }

        if (!editForm.reportValidity()) {
            return;
        }

        const newPass = byId("ep_new_password")?.value ?? "";
        const confirmPass = byId("ep_confirm_password")?.value ?? "";

        if (newPass !== "" || confirmPass !== "") {
            if (newPass.length < 6) {
                showModalNotice(
                    "error",
                    "New Password must be at least 6 characters long."
                );
                byId("ep_new_password")?.focus();
                return;
            }
            if (newPass !== confirmPass) {
                showModalNotice(
                    "error",
                    "New Password and Confirm New Password do not match."
                );
                byId("ep_confirm_password")?.focus();
                return;
            }
        }

        const formData = new FormData(editForm);
        // Profile picture & banner file uploads are UI-only placeholders for now
        formData.delete("profile_picture");
        formData.delete("banner_image");

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = "Saving Changes...";
        }

        try {
            let response;
            try {
                response = await fetch(UPDATE_PROFILE_API_URL, {
                    method: "POST",
                    credentials: "include",
                    body: formData,
                    headers: {
                        Accept: "application/json"
                    }
                });
            } catch (networkErr) {
                window.PERSYSApiErrors.handleNetworkError(networkErr);
                return;
            }

            const checked =
                await window.PERSYSApiErrors.handleResponse(response);
            if (!checked) return;

            const result = await checked.json();
            if (!response.ok || !result.success) {
                showModalNotice(
                    "error",
                    result.message || "Unable to update profile information."
                );
                return;
            }

            await loadAdminProfile();
            closeEditProfileModal();
        } catch (err) {
            console.error("Update profile error:", err);
            showModalNotice(
                "error",
                err.message || "An unexpected error occurred while saving."
            );
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = "Save Changes";
            }
        }
    });

    await loadAdminProfile();
});
