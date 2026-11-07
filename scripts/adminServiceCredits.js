// PERSYS - Admin Service Credits
// Handles summary, Excel upload, preview validation, and Save & Post.

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // --------------------------------------------------
    // 1. API CONFIGURATION
    // --------------------------------------------------

    function getApiBaseUrl() {
        let configuredBase = "";

        // Use the API configuration already loaded by apiConfig.js.
        if (typeof API_BASE_URL !== "undefined") {
            configuredBase = API_BASE_URL;
        } else if (window.API_BASE_URL) {
            configuredBase = window.API_BASE_URL;
        } else if (window.API_BASE) {
            configuredBase = window.API_BASE;
        }

        if (configuredBase) {
            configuredBase = configuredBase.replace(/\/+$/, "");

            // Ensure the base URL ends in /api.
            if (!configuredBase.endsWith("/api")) {
                configuredBase += "/api";
            }

            return configuredBase;
        }

        // Local XAMPP fallback.
        const isLocal =
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1";

        if (isLocal) {
            return `${window.location.protocol}//${window.location.hostname}/PERSYS-BACKEND/api`;
        }

        // Deployed frontend uses the Vercel rewrite.
        return "/api";
    }

    const API_BASE = getApiBaseUrl();

    const API = {
        summary: `${API_BASE}/admin/serviceCredits/summary.php`,
        upload: `${API_BASE}/admin/serviceCredits/upload.php`,
        post: `${API_BASE}/admin/serviceCredits/post.php`
    };

    // --------------------------------------------------
    // 2. ELEMENT REFERENCES
    // --------------------------------------------------

    const form = document.getElementById("serviceCreditForm");
    const fileInput = document.getElementById("excelFileInput");
    const uploadButton = document.getElementById("btnUploadServiceCredits");
    const fileNameDisplay = document.getElementById("scFileName");

    const validationBanner = document.getElementById(
        "serviceCreditValidationBanner"
    );

    const previewBody = document.getElementById(
        "serviceCreditPreviewBody"
    );

    const actionsContainer = document.getElementById(
        "serviceCreditActions"
    );

    const saveButton = document.getElementById(
        "btnSaveServiceCredits"
    );

    const historyBody = document.getElementById(
        "serviceCreditHistoryBody"
    );

    const localCreditsElement = document.getElementById(
        "totalLocalCredits"
    );

    const nationalCreditsElement = document.getElementById(
        "totalNationalCredits"
    );

    const uploadRecordsElement = document.getElementById(
        "totalUploadRecords"
    );

    // Current preview data.
    let previewRows = [];
    let previewFileName = "";

    // --------------------------------------------------
    // 3. GENERAL HELPERS
    // --------------------------------------------------

    async function fetchJson(url, options = {}) {
        const response = await fetch(url, {
            credentials: "include",
            ...options
        });

        let result;

        try {
            result = await response.json();
        } catch {
            throw new Error("The server returned an invalid response.");
        }

        if (!response.ok || result.success === false) {
            throw new Error(
                result.message ||
                `Request failed. HTTP ${response.status}.`
            );
        }

        return result;
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };

            return entities[character];
        });
    }

    function formatCredits(value) {
        const number = Number(value ?? 0);

        return Number.isFinite(number)
            ? number.toLocaleString("en-PH", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            })
            : "0";
    }

    function normalizeName(value) {
        return String(value ?? "")
            .toUpperCase()
            .replace(/[^A-Z0-9\s-]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function isValidDate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
}

    function showBanner(message, type = "error") {
        if (!validationBanner) return;

        const textElement = validationBanner.querySelector(
            ".sc-error-text"
        );

        if (textElement) {
            textElement.textContent = message;
        } else {
            validationBanner.textContent = message;
        }

        validationBanner.classList.remove(
            "sc-error-banner",
            "sc-success-banner"
        );

        validationBanner.classList.add(
            type === "success"
                ? "sc-success-banner"
                : "sc-error-banner"
        );

        validationBanner.style.display = "block";
    }

    function hideBanner() {
        if (!validationBanner) return;

        validationBanner.style.display = "none";
    }

    function setButtonLoading(button, loading, loadingText, normalText) {
        if (!button) return;

        button.disabled = loading;
        button.textContent = loading ? loadingText : normalText;
    }

    // --------------------------------------------------
    // 4. LOAD SUMMARY AND UPLOAD HISTORY
    // --------------------------------------------------

    async function loadSummary() {
        try {
            const result = await fetchJson(API.summary);
            const data = result.data || {};

            if (localCreditsElement) {
                localCreditsElement.textContent = formatCredits(
                    data.total_local_credits
                );
            }

            if (nationalCreditsElement) {
                nationalCreditsElement.textContent = formatCredits(
                    data.total_national_credits
                );
            }

            if (uploadRecordsElement) {
                uploadRecordsElement.textContent = formatCredits(
                    data.total_upload_records
                );
            }

            // Populate sidebar with admin name/role from session
            const sidebarUsername = document.getElementById("sidebarUsername");
            const sidebarRole     = document.getElementById("sidebarRole");
            if (sidebarUsername && data.admin) sidebarUsername.textContent = data.admin.username;
            if (sidebarRole     && data.admin) sidebarRole.textContent     = data.admin.role_name;

            renderUploadHistory(data.upload_history || []);

        } catch (error) {
            console.error("Service Credits Summary Error:", error);

            if (historyBody) {
                historyBody.innerHTML = `
                    <tr>
                        <td colspan="6">
                            Unable to load upload history.
                        </td>
                    </tr>
                `;
            }
        }
    }

    function renderUploadHistory(records) {
        if (!historyBody) return;

        if (!records.length) {
            historyBody.innerHTML = `
                <tr>
                    <td colspan="6">No upload records found.</td>
                </tr>
            `;
            return;
        }

        historyBody.innerHTML = records.map(record => {
            const status = String(record.status || "UNKNOWN");
            const statusClass = status.toLowerCase();

            return `
                <tr>
                    <td>${escapeHtml(record.file_name || "—")}</td>
                    <td>${escapeHtml(record.uploaded_by_name || "—")}</td>
                    <td>${escapeHtml(record.record_count ?? 0)}</td>
                    <td>
                        <span class="sc-status-${escapeHtml(statusClass)}">
                            ${escapeHtml(status)}
                        </span>
                    </td>
                    <td>${escapeHtml(record.uploaded_at || "—")}</td>
                    <td>${escapeHtml(record.posted_at || "—")}</td>
                </tr>
            `;
        }).join("");
    }

    // --------------------------------------------------
    // 5. FILE SELECTION
    // --------------------------------------------------

    if (fileInput) {
        fileInput.addEventListener("change", () => {
            const file = fileInput.files[0];
            const isValid = file && /\.(xlsx|xls)$/i.test(file.name);

            if (fileNameDisplay) {
                fileNameDisplay.textContent = file
                    ? (isValid ? `Selected: ${file.name}` : "Unsupported format. Please select an .xlsx or .xls file.")
                    : "No file selected";
            }

            if (uploadButton) {
                uploadButton.disabled = !isValid;
            }

            hideBanner();
        });
    }

    // --------------------------------------------------
    // 6. ROW VALIDATION
    // --------------------------------------------------

    function validateRow(row) {
        const errors = [];

        if (!String(row.employee_number || "").trim()) {
            errors.push("Employee number is required.");
        }

        if (!String(row.employee_name || "").trim()) {
            errors.push("Employee name is required.");
        }

        if (
            row.employee_name &&
            row.database_employee_name &&
            normalizeName(row.employee_name) !==
            normalizeName(row.database_employee_name)
        ) {
            errors.push(
                "Employee name does not match the employee number."
            );
        }

        if (!String(row.name_of_activity || "").trim()) {
            errors.push("Activity name is required.");
        }

        if (!isValidDate(row.activity_start_date)) {
            errors.push("A valid start date is required.");
        }

        if (!isValidDate(row.activity_end_date)) {
            errors.push("A valid end date is required.");
        }

        if (
            isValidDate(row.activity_start_date) &&
            isValidDate(row.activity_end_date) &&
            row.activity_end_date < row.activity_start_date
        ) {
            errors.push("End date cannot be earlier than start date.");
        }

        const credits = Number(row.number_of_service_credits);

        if (
            row.number_of_service_credits === "" ||
            !Number.isFinite(credits) ||
            credits <= 0
        ) {
            errors.push("Service credits must be greater than zero.");
        }

        const nature = String(
            row.nature_of_service_credits || ""
        ).toUpperCase();

        if (!["LOCAL", "NATIONAL"].includes(nature)) {
            errors.push("Nature must be LOCAL or NATIONAL.");
        }

        row.status = errors.length ? "invalid" : "valid";
        row.errors = errors;

        return errors;
    }

    function getValidationSummary() {
        let validCount = 0;
        let invalidCount = 0;

        previewRows.forEach(row => {
            validateRow(row);

            if (row.status === "valid") {
                validCount++;
            } else {
                invalidCount++;
            }
        });

        return {
            validCount,
            invalidCount,
            total: previewRows.length
        };
    }

    // --------------------------------------------------
    // 7. RENDER PREVIEW TABLE
    // --------------------------------------------------

    function renderPreview() {
        if (!previewBody) return;

        if (!previewRows.length) {
            previewBody.innerHTML = `
                <tr>
                    <td colspan="9">No preview records available.</td>
                </tr>
            `;

            if (actionsContainer) {
                actionsContainer.style.display = "none";
            }

            return;
        }

        previewRows.forEach(validateRow);

        previewBody.innerHTML = previewRows.map((row, index) => {
            const rowClass = row.status === "valid"
                ? "sc-row-valid"
                : "sc-row-invalid";

            const statusClass = row.status === "valid"
                ? "sc-status-valid"
                : "sc-status-invalid";

            const errorsHtml = row.errors.length
                ? `
                    <ul class="sc-row-errors">
                        ${row.errors.map(error =>
                            `<li>${escapeHtml(error)}</li>`
                        ).join("")}
                    </ul>
                `
                : "";

            return `
                <tr class="${rowClass}" data-index="${index}">
                    <td>
                        <input
                            type="text"
                            class="sc-preview-input"
                            data-field="employee_number"
                            value="${escapeHtml(row.employee_number)}"
                        >
                    </td>

                    <td>
                        <input
                            type="text"
                            class="sc-preview-input name"
                            data-field="employee_name"
                            value="${escapeHtml(row.employee_name)}"
                        >
                    </td>

                    <td>
                        <input
                            type="text"
                            class="sc-preview-input activity"
                            data-field="name_of_activity"
                            value="${escapeHtml(row.name_of_activity)}"
                        >
                    </td>

                    <td>
                        <input
                            type="date"
                            class="sc-preview-input date"
                            data-field="activity_start_date"
                            value="${escapeHtml(row.activity_start_date)}"
                        >
                    </td>

                    <td>
                        <input
                            type="date"
                            class="sc-preview-input date"
                            data-field="activity_end_date"
                            value="${escapeHtml(row.activity_end_date)}"
                        >
                    </td>

                    <td>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            class="sc-preview-input credit"
                            data-field="number_of_service_credits"
                            value="${escapeHtml(row.number_of_service_credits)}"
                        >
                    </td>

                    <td>
                        <select
                            class="sc-preview-select"
                            data-field="nature_of_service_credits"
                        >
                            <option
                                value="LOCAL"
                                ${String(row.nature_of_service_credits).toUpperCase() === "LOCAL" ? "selected" : ""}
                            >
                                LOCAL
                            </option>

                            <option
                                value="NATIONAL"
                                ${String(row.nature_of_service_credits).toUpperCase() === "NATIONAL" ? "selected" : ""}
                            >
                                NATIONAL
                            </option>
                        </select>
                    </td>

                    <td>
                        <span class="${statusClass}">
                            ${row.status === "valid" ? "Valid" : "Invalid"}
                        </span>

                        ${errorsHtml}
                    </td>

                    <td>
                        <button
                            type="button"
                            class="sc-remove-row"
                            data-action="remove"
                            title="Remove row"
                        >
                            Remove
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        updatePreviewSummary();
    }

    // --------------------------------------------------
    // 8. UPDATE PREVIEW VALIDATION
    // --------------------------------------------------

    function updatePreviewSummary() {
        const summary = getValidationSummary();

        if (saveButton) {
            saveButton.disabled =
                summary.total === 0 ||
                summary.invalidCount > 0;
        }

        if (actionsContainer) {
            actionsContainer.style.display =
                summary.total > 0 ? "flex" : "none";
        }

        if (summary.invalidCount > 0) {
            showBanner(
                `${summary.invalidCount} of ${summary.total} record(s) need correction. Please review the highlighted rows.`,
                "error"
            );
        } else if (summary.total > 0) {
            showBanner(
                `All ${summary.validCount} record(s) passed validation. You may now Save & Post.`,
                "success"
            );
        }
    }

    // --------------------------------------------------
    // 9. PREVIEW TABLE EDITING AND ROW REMOVAL
    // --------------------------------------------------

    if (previewBody) {
        previewBody.addEventListener("input", event => {
            const fieldElement = event.target.closest("[data-field]");

            if (!fieldElement) return;

            const rowElement = fieldElement.closest("tr[data-index]");

            if (!rowElement) return;

            const index = Number(rowElement.dataset.index);
            const field = fieldElement.dataset.field;

            if (!previewRows[index]) return;

            previewRows[index][field] = fieldElement.value;

            // Update validation without rebuilding the input fields.
            validateRow(previewRows[index]);

            const row = previewRows[index];

            rowElement.classList.toggle(
                "sc-row-valid",
                row.status === "valid"
            );

            rowElement.classList.toggle(
                "sc-row-invalid",
                row.status === "invalid"
            );

            const statusCell = rowElement.children[7];

            if (statusCell) {
                const statusClass = row.status === "valid"
                    ? "sc-status-valid"
                    : "sc-status-invalid";

                statusCell.innerHTML = `
                    <span class="${statusClass}">
                        ${row.status === "valid" ? "Valid" : "Invalid"}
                    </span>

                    ${
                        row.errors.length
                            ? `<ul class="sc-row-errors">
                                ${row.errors.map(error =>
                                    `<li>${escapeHtml(error)}</li>`
                                ).join("")}
                               </ul>`
                            : ""
                    }
                `;
            }

            updatePreviewSummary();
        });

        previewBody.addEventListener("change", event => {
            const fieldElement = event.target.closest("[data-field]");

            if (!fieldElement) return;

            const rowElement = fieldElement.closest("tr[data-index]");

            if (!rowElement) return;

            const index = Number(rowElement.dataset.index);
            const field = fieldElement.dataset.field;

            if (!previewRows[index]) return;

            previewRows[index][field] = fieldElement.value;

            validateRow(previewRows[index]);
            renderPreview();
        });

        previewBody.addEventListener("click", event => {
            const removeButton = event.target.closest(
                '[data-action="remove"]'
            );

            if (!removeButton) return;

            const rowElement = removeButton.closest("tr[data-index]");

            if (!rowElement) return;

            const index = Number(rowElement.dataset.index);

            previewRows.splice(index, 1);

            renderPreview();
        });
    }

    // --------------------------------------------------
    // 10. UPLOAD AND VALIDATE EXCEL FILE
    // --------------------------------------------------

    if (form) {
        form.addEventListener("submit", async event => {
            event.preventDefault();

            const file = fileInput?.files[0];

            if (!file) {
                showBanner("Please select an Excel file first.", "error");
                return;
            }

            const extension = file.name
                .split(".")
                .pop()
                .toLowerCase();

            if (!["xlsx", "xls"].includes(extension)) {
                showBanner(
                    "Only .xlsx and .xls Excel files are supported.",
                    "error"
                );
                return;
            }

            const formData = new FormData(form);

            try {
                hideBanner();

                setButtonLoading(
                    uploadButton,
                    true,
                    "Uploading...",
                    "Upload & Validate"
                );

                const result = await fetchJson(API.upload, {
                    method: "POST",
                    body: formData
                });

                previewFileName = result.file_name || file.name;
                previewRows = result.rows || [];

                renderPreview();

                if (!previewRows.length) {
                    showBanner(
                        "The uploaded file contains no records to preview.",
                        "error"
                    );
                    return;
                }

                const summary = getValidationSummary();

                showBanner(
                    `Upload validation completed. ${summary.validCount} valid record(s), ${summary.invalidCount} invalid record(s).`,
                    summary.invalidCount > 0 ? "error" : "success"
                );

            } catch (error) {
                console.error("Service Credits Upload Error:", error);

                previewRows = [];
                previewFileName = "";

                renderPreview();

                showBanner(
                    error.message || "Unable to upload the Excel file.",
                    "error"
                );

            } finally {
                setButtonLoading(
                    uploadButton,
                    false,
                    "Uploading...",
                    "Upload & Validate"
                );
            }
        });
    }

    // --------------------------------------------------
    // 11. SAVE & POST SERVICE CREDITS
    // --------------------------------------------------

    if (saveButton) {
        saveButton.addEventListener("click", async () => {
            const summary = getValidationSummary();

            if (!summary.total) {
                showBanner("There are no records to post.", "error");
                return;
            }

            if (summary.invalidCount > 0) {
                showBanner(
                    "Please correct all invalid records before posting.",
                    "error"
                );
                return;
            }

            const confirmed = window.confirm(
                `Are you sure you want to Save & Post ${summary.total} service-credit record(s)?`
            );

            if (!confirmed) return;

            try {
                setButtonLoading(
                    saveButton,
                    true,
                    "Saving & Posting...",
                    "Save & Post"
                );

                const result = await fetchJson(API.post, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        file_name: previewFileName,
                        rows: previewRows
                    })
                });

                showBanner(
                    result.message ||
                    `${result.posted_count} record(s) successfully posted.`,
                    "success"
                );

                // Clear the preview after successful posting.
                previewRows = [];
                previewFileName = "";

                renderPreview();

                if (form) {
                    form.reset();
                }

                if (fileNameDisplay) {
                    fileNameDisplay.textContent = "No file selected";
                }

                await loadSummary();

            } catch (error) {
                console.error("Service Credits Posting Error:", error);

                showBanner(
                    error.message ||
                    "Unable to save and post service credits.",
                    "error"
                );

            } finally {
                setButtonLoading(
                    saveButton,
                    false,
                    "Saving & Posting...",
                    "Save & Post"
                );

                // Recalculate button state after the request.
                if (previewRows.length) {
                    updatePreviewSummary();
                }
            }
        });
    }

    // --------------------------------------------------
    // 12. INITIAL PAGE LOAD
    // --------------------------------------------------

    loadSummary();
});
