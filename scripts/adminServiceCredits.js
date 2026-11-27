// PERSYS - Admin Service Credits (Manage Service Credits)
// Handles summary, Excel upload & Data Preview, Manual Upload (1–5 rows),
// Personnel Service Credits Records tracker, and Activities popup modal.

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // --------------------------------------------------
    // 1. API CONFIGURATION
    // --------------------------------------------------

    function getApiBaseUrl() {
        let configuredBase = "";

        if (typeof API_BASE_URL !== "undefined") {
            configuredBase = API_BASE_URL;
        } else if (window.API_BASE_URL) {
            configuredBase = window.API_BASE_URL;
        } else if (window.PERSYS_CONFIG && window.PERSYS_CONFIG.API_BASE_URL) {
            configuredBase = window.PERSYS_CONFIG.API_BASE_URL;
        } else if (window.API_BASE) {
            configuredBase = window.API_BASE;
        }

        if (configuredBase) {
            configuredBase = configuredBase.replace(/\/+$/, "");
            if (!configuredBase.endsWith("/api")) {
                configuredBase += "/api";
            }
            return configuredBase;
        }

        const isLocal =
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1";

        if (isLocal) {
            return `${window.location.protocol}//${window.location.hostname}/PERSYS-BACKEND/api`;
        }

        return "/api";
    }

    const API_BASE = getApiBaseUrl();

    const API = {
        summary: `${API_BASE}/admin/serviceCredits/summary.php`,
        upload: `${API_BASE}/admin/serviceCredits/upload.php`,
        post: `${API_BASE}/admin/serviceCredits/post.php`,
        employeeActivities: `${API_BASE}/admin/serviceCredits/employeeActivities.php`
    };

    const MAX_MANUAL_ROWS = 5;

    // --------------------------------------------------
    // 2. ELEMENT REFERENCES
    // --------------------------------------------------

    const form = document.getElementById("serviceCreditForm");
    const fileInput = document.getElementById("excelFileInput");
    const uploadButton = document.getElementById("btnUploadServiceCredits");
    const fileNameDisplay = document.getElementById("scFileName");

    const validationBanner = document.getElementById("serviceCreditValidationBanner");
    const previewEmptyBox = document.getElementById("scPreviewEmptyBox");
    const previewTableWrap = document.getElementById("scPreviewTableWrap");
    const previewBody = document.getElementById("serviceCreditPreviewBody");
    const previewPagination = document.getElementById("scPreviewPagination");
    const saveButton = document.getElementById("btnSaveServiceCredits");

    // Manual Upload elements
    const manualBanner = document.getElementById("manualUploadBanner");
    const manualBannerText = document.getElementById("manualUploadBannerText");
    const manualRowsContainer = document.getElementById("manualUploadRowsContainer");
    const manualAddArea = document.getElementById("manualAddPersonnelArea");
    const manualNextRowIndex = document.getElementById("manualNextRowIndex");
    const btnAddManualPersonnel = document.getElementById("btnAddManualPersonnel");
    const btnSubmitManualUpload = document.getElementById("btnSubmitManualUpload");

    // Personnel Service Credits Records elements
    const personnelSearchInput = document.getElementById("scPersonnelSearch");
    const personnelRecordsBody = document.getElementById("scPersonnelRecordsBody");
    const personnelPagination = document.getElementById("scPersonnelPagination");

    // Activities Modal elements
    const activitiesModalOverlay = document.getElementById("scActivitiesModalOverlay");
    const activitiesModal = document.getElementById("scActivitiesModal");
    const activitiesCloseBtn = document.getElementById("scActivitiesCloseBtn");
    const activitiesEmployeeName = document.getElementById("scActivitiesEmployeeName");
    const activitiesTableBody = document.getElementById("scActivitiesTableBody");

    // Summary stat elements
    const localCreditsElement = document.getElementById("totalLocalCredits");
    const nationalCreditsElement = document.getElementById("totalNationalCredits");
    const uploadRecordsElement = document.getElementById("totalUploadRecords");

    // State
    let previewRows = [];
    let previewFileName = "";
    let previewPage = 1;
    let previewPerPage = 5;

    let employeesList = [];
    let manualRows = [createEmptyManualRow()];

    let personnelRecords = [];
    let personnelPage = 1;
    let personnelPerPage = 5;

    function createEmptyManualRow() {
        return {
            employee_number: "",
            employee_name: "",
            name_of_activity: "",
            activity_start_date: "",
            activity_end_date: "",
            number_of_service_credits: "",
            nature_of_service_credits: ""
        };
    }

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
                result.message || `Request failed. HTTP ${response.status}.`
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

    function formatTwoDecimals(value) {
        const number = Number(value ?? 0);
        return Number.isFinite(number) ? number.toFixed(2) : "0.00";
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
        const textElement = validationBanner.querySelector(".sc-error-text");
        if (textElement) {
            textElement.textContent = message;
        } else {
            validationBanner.textContent = message;
        }

        validationBanner.classList.remove("sc-error-banner", "sc-success-banner");
        validationBanner.classList.add(
            type === "success" ? "sc-success-banner" : "sc-error-banner"
        );
        validationBanner.style.display = "flex";
    }

    function hideBanner() {
        if (!validationBanner) return;
        validationBanner.style.display = "none";
    }

    function showManualBanner(message, type = "error") {
        if (!manualBanner) return;
        if (manualBannerText) {
            manualBannerText.textContent = message;
        } else {
            manualBanner.textContent = message;
        }
        manualBanner.classList.remove("sc-error-banner", "sc-success-banner");
        manualBanner.classList.add(
            type === "success" ? "sc-success-banner" : "sc-error-banner"
        );
        manualBanner.style.display = "flex";
    }

    function hideManualBanner() {
        if (!manualBanner) return;
        manualBanner.style.display = "none";
    }

    // --------------------------------------------------
    // 4. LOAD SUMMARY, EMPLOYEES, AND PERSONNEL RECORDS
    // --------------------------------------------------

    async function loadSummary() {
        try {
            const result = await fetchJson(API.summary);
            const data = result.data || {};

            if (localCreditsElement) {
                localCreditsElement.textContent = formatCredits(data.total_local_credits);
            }
            if (nationalCreditsElement) {
                nationalCreditsElement.textContent = formatCredits(data.total_national_credits);
            }
            if (uploadRecordsElement) {
                const countVal =
                    data.total_uploaded_files !== undefined
                        ? data.total_uploaded_files
                        : data.total_upload_records;
                uploadRecordsElement.textContent = formatCredits(countVal);
            }

            const sidebarUsername = document.getElementById("sidebarUsername");
            const sidebarRole = document.getElementById("sidebarRole");
            if (sidebarUsername && data.admin) sidebarUsername.textContent = data.admin.username;
            if (sidebarRole && data.admin) sidebarRole.textContent = data.admin.role_name;

            if (Array.isArray(data.employees)) {
                employeesList = data.employees;
                renderManualUploadRows();
            }

            personnelRecords = Array.isArray(data.personnel_records)
                ? data.personnel_records
                : [];
            renderPersonnelRecordsTable();

        } catch (error) {
            console.error("Service Credits Summary Error:", error);

            if (personnelRecordsBody) {
                personnelRecordsBody.innerHTML = `
                    <tr>
                        <td colspan="13" style="text-align:center;padding:32px;color:#9ca3af;font-style:italic;">
                            Unable to load personnel service credit records.
                        </td>
                    </tr>
                `;
            }
            if (personnelPagination) {
                personnelPagination.replaceChildren();
            }
        }
    }

    // --------------------------------------------------
    // 4B. PERSONNEL SERVICE CREDITS RECORDS TABLE
    // --------------------------------------------------

    function getFilteredPersonnelRecords() {
        const term = String(personnelSearchInput?.value || "").trim().toLowerCase();
        if (!term) return personnelRecords;

        return personnelRecords.filter(rec => {
            const empNo = String(rec.employee_number || "").toLowerCase();
            const name = String(rec.employee_name || "").toLowerCase();
            const role = String(rec.role || "").toLowerCase();
            return (
                empNo.includes(term) ||
                name.includes(term) ||
                role.includes(term)
            );
        });
    }

    function renderPersonnelRecordsTable() {
        if (!personnelRecordsBody) return;

        const filtered = getFilteredPersonnelRecords();
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / personnelPerPage));
        personnelPage = Math.min(Math.max(1, personnelPage), totalPages);

        personnelRecordsBody.replaceChildren();

        if (total === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 13;
            td.style.cssText = "text-align:center;padding:32px;color:#9ca3af;font-style:italic;";
            td.textContent = personnelRecords.length
                ? "No matching personnel service credit records found."
                : "No personnel records found.";
            tr.appendChild(td);
            personnelRecordsBody.appendChild(tr);

            renderPersonnelPagination(0, 1);
            return;
        }

        const startIdx = (personnelPage - 1) * personnelPerPage;
        const visible = filtered.slice(startIdx, startIdx + personnelPerPage);

        visible.forEach(rec => {
            personnelRecordsBody.appendChild(buildPersonnelRecordRow(rec));
        });

        renderPersonnelPagination(total, totalPages);
    }

    function buildPersonnelRecordRow(rec) {
        const tr = document.createElement("tr");

        const tdEmpNo = document.createElement("td");
        tdEmpNo.textContent = rec.employee_number || "—";

        const tdName = document.createElement("td");
        tdName.textContent = rec.employee_name || "—";

        const tdRole = document.createElement("td");
        tdRole.textContent = rec.role || "—";

        // Current Balance (L, N, W)
        const tdBalL = makeNumericCell(rec.balance_national, true);
        const tdBalN = makeNumericCell(rec.balance_wellness, false);
        const tdBalW = makeNumericCell(rec.balance_local, false);

        // Overall Earned (L, N, W)
        const tdEarnL = makeNumericCell(rec.earned_national, true);
        const tdEarnN = makeNumericCell(rec.earned_wellness, false);
        const tdEarnW = makeNumericCell(rec.earned_local, false);

        // Total Used (L, N, W)
        const tdUsedL = makeNumericCell(rec.used_national, true);
        const tdUsedN = makeNumericCell(rec.used_wellness, false);
        const tdUsedW = makeNumericCell(rec.used_local, false);

        // Activities "View" button
        const tdAction = document.createElement("td");
        tdAction.className = "sc-action-cell";

        const viewBtn = document.createElement("button");
        viewBtn.type = "button";
        viewBtn.className = "btn-sc-activities-view";
        viewBtn.textContent = "View";
        viewBtn.addEventListener("click", () => openActivitiesModal(rec));
        tdAction.appendChild(viewBtn);

        tr.append(
            tdEmpNo,
            tdName,
            tdRole,
            tdBalL,
            tdBalN,
            tdBalW,
            tdEarnL,
            tdEarnN,
            tdEarnW,
            tdUsedL,
            tdUsedN,
            tdUsedW,
            tdAction
        );

        return tr;
    }

    function makeNumericCell(val, isGroupStart) {
        const td = document.createElement("td");
        td.className = "sc-num-cell" + (isGroupStart ? " sc-num-group-start" : "");
        td.textContent = formatTwoDecimals(val);
        return td;
    }

    function renderPersonnelPagination(totalRecords, totalPages) {
        if (!personnelPagination) return;
        personnelPagination.replaceChildren();

        const info = document.createElement("span");
        info.className = "pagination-info";

        const start = totalRecords === 0
            ? 0
            : (personnelPage - 1) * personnelPerPage + 1;
        const end = Math.min(personnelPage * personnelPerPage, totalRecords);

        info.textContent = `Showing ${start}–${end} of ${totalRecords} records`;

        const controls = document.createElement("div");
        controls.className = "pagination-controls";

        const perPageLabel = document.createElement("label");
        perPageLabel.textContent = "Rows per page: ";

        const perPageSelect = document.createElement("select");
        perPageSelect.className = "pagination-select";

        [5, 10, 20].forEach(amount => {
            const option = document.createElement("option");
            option.value = amount;
            option.textContent = amount;
            option.selected = personnelPerPage === amount;
            perPageSelect.appendChild(option);
        });

        perPageSelect.addEventListener("change", function () {
            personnelPerPage = Number(this.value);
            personnelPage = 1;
            renderPersonnelRecordsTable();
        });

        perPageLabel.appendChild(perPageSelect);
        controls.appendChild(perPageLabel);

        const prevBtn = createPaginationButton(
            "‹",
            personnelPage === 1,
            () => {
                personnelPage--;
                renderPersonnelRecordsTable();
            }
        );
        prevBtn.setAttribute("aria-label", "Previous page");
        controls.appendChild(prevBtn);

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const btn = createPaginationButton(
                String(pageNum),
                false,
                () => {
                    personnelPage = pageNum;
                    renderPersonnelRecordsTable();
                }
            );
            if (pageNum === personnelPage) {
                btn.classList.add("is-active");
                btn.setAttribute("aria-current", "page");
            }
            controls.appendChild(btn);
        }

        const nextBtn = createPaginationButton(
            "›",
            personnelPage === totalPages,
            () => {
                personnelPage++;
                renderPersonnelRecordsTable();
            }
        );
        nextBtn.setAttribute("aria-label", "Next page");
        controls.appendChild(nextBtn);

        personnelPagination.append(info, controls);
    }

    if (personnelSearchInput) {
        personnelSearchInput.addEventListener("input", () => {
            personnelPage = 1;
            renderPersonnelRecordsTable();
        });
    }

    // --------------------------------------------------
    // 4C. ACTIVITIES MODAL POPUP (When clicking "View")
    // --------------------------------------------------

    function wireActivitiesModal() {
        activitiesCloseBtn?.addEventListener("click", closeActivitiesModal);
        activitiesModalOverlay?.addEventListener("click", event => {
            if (event.target === activitiesModalOverlay) {
                closeActivitiesModal();
            }
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && activitiesModalOverlay?.classList.contains("is-open")) {
                closeActivitiesModal();
            }
        });
    }

    function closeActivitiesModal() {
        activitiesModalOverlay?.classList.remove("is-open");
        document.body.style.overflow = "";
    }

    async function openActivitiesModal(rec) {
        if (!activitiesModalOverlay || !activitiesModal) return;

        if (activitiesEmployeeName) {
            activitiesEmployeeName.textContent = rec.employee_name || "—";
        }

        if (activitiesTableBody) {
            activitiesTableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center;padding:24px;color:#6b7280;">
                        Loading activities...
                    </td>
                </tr>
            `;
        }

        activitiesModalOverlay.classList.add("is-open");
        document.body.style.overflow = "hidden";
        activitiesModal.focus();

        const empId = Number(rec.employee_id || 0);
        if (empId <= 0) {
            renderActivitiesModalEmpty("No activities found for this employee.");
            return;
        }

        try {
            const result = await fetchJson(
                `${API.employeeActivities}?employee_id=${encodeURIComponent(empId)}`
            );

            const empInfo = result.data?.employee;
            if (empInfo && activitiesEmployeeName) {
                activitiesEmployeeName.textContent =
                    empInfo.employee_name || rec.employee_name || "—";
            }

            const activities = Array.isArray(result.data?.activities)
                ? result.data.activities
                : [];

            if (!activities.length) {
                renderActivitiesModalEmpty("No service credit activities recorded yet.");
                return;
            }

            if (activitiesTableBody) {
                activitiesTableBody.replaceChildren();
                activities.forEach(act => {
                    const tr = document.createElement("tr");

                    const tdActivity = document.createElement("td");
                    tdActivity.textContent = act.activity_name || "—";

                    const tdDate = document.createElement("td");
                    tdDate.textContent = act.date_display || "—";

                    const tdCredits = document.createElement("td");
                    tdCredits.textContent = formatTwoDecimals(act.credit_amount);

                    const tdType = document.createElement("td");
                    tdType.textContent = act.credit_type || "—";

                    tr.append(tdActivity, tdDate, tdCredits, tdType);
                    activitiesTableBody.appendChild(tr);
                });
            }
        } catch (error) {
            console.error("Employee activities load error:", error);
            renderActivitiesModalEmpty(
                error.message || "Unable to load employee activities."
            );
        }
    }

    function renderActivitiesModalEmpty(message) {
        if (!activitiesTableBody) return;
        activitiesTableBody.replaceChildren();
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.style.cssText = "text-align:center;padding:24px;color:#9ca3af;font-style:italic;";
        td.textContent = message;
        tr.appendChild(td);
        activitiesTableBody.appendChild(tr);
    }

    // --------------------------------------------------
    // 5. EXCEL FILE SELECTION & UPLOAD PREVIEW
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

            hideBanner();
        });
    }

    // --------------------------------------------------
    // 6. EXCEL ROW VALIDATION
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
            normalizeName(row.employee_name) !== normalizeName(row.database_employee_name)
        ) {
            errors.push("Employee name does not match the employee number.");
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

        const nature = String(row.nature_of_service_credits || "").toUpperCase();

        if (!["LOCAL", "NATIONAL", "WELLNESS"].includes(nature)) {
            errors.push("Credit type must be LOCAL, NATIONAL, or WELLNESS.");
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
    // 7. RENDER DATA PREVIEW TABLE (WITH EMPLOYEES-STYLE PAGINATION)
    // --------------------------------------------------

    function renderPreview() {
        if (!previewBody) return;

        const total = previewRows.length;

        if (!total) {
            previewBody.innerHTML = "";
            if (previewEmptyBox) previewEmptyBox.style.display = "block";
            if (previewTableWrap) previewTableWrap.style.display = "none";
            if (previewPagination) {
                previewPagination.style.display = "none";
                previewPagination.replaceChildren();
            }
            if (saveButton) saveButton.disabled = true;
            return;
        }

        if (previewEmptyBox) previewEmptyBox.style.display = "none";
        if (previewTableWrap) previewTableWrap.style.display = "block";
        if (previewPagination) previewPagination.style.display = "flex";

        previewRows.forEach(validateRow);

        const totalPages = Math.max(1, Math.ceil(total / previewPerPage));
        previewPage = Math.min(Math.max(1, previewPage), totalPages);

        const startIdx = (previewPage - 1) * previewPerPage;
        const endIdx = Math.min(startIdx + previewPerPage, total);
        const visibleRows = previewRows.slice(startIdx, endIdx);

        previewBody.innerHTML = visibleRows.map((row, localIdx) => {
            const globalIndex = startIdx + localIdx;
            const rowClass = row.status === "valid" ? "sc-row-valid" : "sc-row-invalid";
            const statusClass = row.status === "valid" ? "sc-status-valid" : "sc-status-invalid";
            const natureUpper = String(row.nature_of_service_credits || "").toUpperCase();

            const errorsHtml = row.errors.length
                ? `
                    <ul class="sc-row-errors">
                        ${row.errors.map(error => `<li>${escapeHtml(error)}</li>`).join("")}
                    </ul>
                `
                : "";

            return `
                <tr class="${rowClass}" data-index="${globalIndex}">
                    <td>
                        <input
                            type="text"
                            class="sc-preview-input number"
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
                            <option value="LOCAL" ${natureUpper === "LOCAL" ? "selected" : ""}>LOCAL</option>
                            <option value="NATIONAL" ${natureUpper === "NATIONAL" ? "selected" : ""}>NATIONAL</option>
                            <option value="WELLNESS" ${natureUpper === "WELLNESS" ? "selected" : ""}>WELLNESS</option>
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

        renderPreviewPagination(total, totalPages);
        updatePreviewSummary();
    }

    function renderPreviewPagination(totalRecords, totalPages) {
        if (!previewPagination) return;
        previewPagination.replaceChildren();

        const info = document.createElement("span");
        info.className = "pagination-info";

        const start = totalRecords === 0
            ? 0
            : (previewPage - 1) * previewPerPage + 1;
        const end = Math.min(previewPage * previewPerPage, totalRecords);

        info.textContent = `Showing ${start}–${end} of ${totalRecords} records`;

        const controls = document.createElement("div");
        controls.className = "pagination-controls";

        const perPageLabel = document.createElement("label");
        perPageLabel.textContent = "Rows per page: ";

        const perPageSelect = document.createElement("select");
        perPageSelect.className = "pagination-select";

        [5, 10, 20].forEach(amount => {
            const option = document.createElement("option");
            option.value = amount;
            option.textContent = amount;
            option.selected = previewPerPage === amount;
            perPageSelect.appendChild(option);
        });

        perPageSelect.addEventListener("change", function () {
            previewPerPage = Number(this.value);
            previewPage = 1;
            renderPreview();
        });

        perPageLabel.appendChild(perPageSelect);
        controls.appendChild(perPageLabel);

        const prevBtn = createPaginationButton(
            "‹",
            previewPage === 1,
            () => {
                previewPage--;
                renderPreview();
            }
        );
        prevBtn.setAttribute("aria-label", "Previous page");
        controls.appendChild(prevBtn);

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const btn = createPaginationButton(
                String(pageNum),
                false,
                () => {
                    previewPage = pageNum;
                    renderPreview();
                }
            );
            if (pageNum === previewPage) {
                btn.classList.add("is-active");
                btn.setAttribute("aria-current", "page");
            }
            controls.appendChild(btn);
        }

        const nextBtn = createPaginationButton(
            "›",
            previewPage === totalPages,
            () => {
                previewPage++;
                renderPreview();
            }
        );
        nextBtn.setAttribute("aria-label", "Next page");
        controls.appendChild(nextBtn);

        previewPagination.append(info, controls);
    }

    function createPaginationButton(label, disabled, onClick) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "pagination-button";
        button.textContent = label;
        button.disabled = disabled;
        button.addEventListener("click", onClick);
        return button;
    }

    function updatePreviewSummary() {
        const summary = getValidationSummary();

        if (saveButton) {
            saveButton.disabled = summary.total === 0 || summary.invalidCount > 0;
        }

        if (summary.invalidCount > 0) {
            showBanner(
                `${summary.invalidCount} of ${summary.total} record(s) need correction. Please review the highlighted rows.`,
                "error"
            );
        } else if (summary.total > 0) {
            showBanner(
                `All ${summary.validCount} record(s) passed validation. You may now click Upload & Save.`,
                "success"
            );
        }
    }

    // --------------------------------------------------
    // 8. PREVIEW TABLE EDITING AND ROW REMOVAL
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
            validateRow(previewRows[index]);

            const row = previewRows[index];
            rowElement.classList.toggle("sc-row-valid", row.status === "valid");
            rowElement.classList.toggle("sc-row-invalid", row.status === "invalid");

            const statusCell = rowElement.children[7];
            if (statusCell) {
                const statusClass = row.status === "valid" ? "sc-status-valid" : "sc-status-invalid";
                statusCell.innerHTML = `
                    <span class="${statusClass}">
                        ${row.status === "valid" ? "Valid" : "Invalid"}
                    </span>
                    ${row.errors.length
                        ? `<ul class="sc-row-errors">
                                ${row.errors.map(error => `<li>${escapeHtml(error)}</li>`).join("")}
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
            const removeButton = event.target.closest('[data-action="remove"]');
            if (!removeButton) return;

            const rowElement = removeButton.closest("tr[data-index]");
            if (!rowElement) return;

            const index = Number(rowElement.dataset.index);
            previewRows.splice(index, 1);
            renderPreview();
            if (!previewRows.length) {
                hideBanner();
            }
        });
    }

    // --------------------------------------------------
    // 9. UPLOAD AND VALIDATE EXCEL FILE
    // --------------------------------------------------

    async function handleExcelUploadSubmit() {
        const file = fileInput?.files[0];

        if (!file) {
            if (fileInput) {
                fileInput.click();
            } else {
                showBanner("Please select an Excel file first.", "error");
            }
            return;
        }

        const extension = file.name.split(".").pop().toLowerCase();
        if (!["xlsx", "xls"].includes(extension)) {
            showBanner("Only .xlsx and .xls Excel files are supported.", "error");
            return;
        }

        const formData = new FormData(form);
        const originalHtml = uploadButton ? uploadButton.innerHTML : "";

        try {
            hideBanner();
            if (uploadButton) {
                uploadButton.disabled = true;
                uploadButton.textContent = "Uploading...";
            }

            const result = await fetchJson(API.upload, {
                method: "POST",
                body: formData
            });

            previewFileName = result.file_name || file.name;
            previewRows = result.rows || [];
            previewPage = 1;

            renderPreview();

            if (!previewRows.length) {
                showBanner("The uploaded file contains no records to preview.", "error");
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
            showBanner(error.message || "Unable to upload the Excel file.", "error");
        } finally {
            if (uploadButton) {
                uploadButton.disabled = false;
                uploadButton.innerHTML = originalHtml;
            }
        }
    }

    if (form) {
        form.addEventListener("submit", async event => {
            event.preventDefault();
            await handleExcelUploadSubmit();
        });
    }

    // --------------------------------------------------
    // 10. UPLOAD & SAVE (EXCEL DATA PREVIEW POSTING)
    // --------------------------------------------------

    if (saveButton) {
        saveButton.addEventListener("click", async () => {
            const summary = getValidationSummary();

            if (!summary.total) {
                showBanner("There are no records to post.", "error");
                return;
            }

            if (summary.invalidCount > 0) {
                showBanner("Please correct all invalid records before saving.", "error");
                return;
            }

            const confirmed = window.confirm(
                `Are you sure you want to Upload & Save ${summary.total} service-credit record(s)?`
            );
            if (!confirmed) return;

            const originalText = saveButton.textContent;
            try {
                saveButton.disabled = true;
                saveButton.textContent = "Saving...";

                const result = await fetchJson(API.post, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        file_name: previewFileName,
                        rows: previewRows
                    })
                });

                showBanner(
                    result.message || `${result.posted_count} record(s) successfully posted.`,
                    "success"
                );

                previewRows = [];
                previewFileName = "";
                renderPreview();

                if (form) form.reset();
                if (fileNameDisplay) fileNameDisplay.textContent = "No file selected";

                await loadSummary();

            } catch (error) {
                console.error("Service Credits Posting Error:", error);
                showBanner(
                    error.message || "Unable to save and post service credits.",
                    "error"
                );
            } finally {
                saveButton.textContent = originalText;
                if (previewRows.length) {
                    updatePreviewSummary();
                } else {
                    saveButton.disabled = true;
                }
            }
        });
    }

    // --------------------------------------------------
    // 11. MANUAL UPLOAD (1 TO 5 ROWS MAX)
    // --------------------------------------------------

    function buildEmployeeOptionsHtml(selectedEmployeeNumber) {
        const defaultOpt = `<option value="">Select employee</option>`;
        const options = employeesList.map(emp => {
            const empNo = String(emp.employee_number || "");
            const empDbName = String(emp.employee_name || "");
            const label = String(emp.display_name || emp.employee_name || empNo);
            const selected = empNo && empNo === String(selectedEmployeeNumber || "") ? "selected" : "";
            return `<option value="${escapeHtml(empNo)}" data-employee-name="${escapeHtml(empDbName)}" ${selected}>${escapeHtml(label)}</option>`;
        });
        return defaultOpt + options.join("");
    }

    function renderManualUploadRows() {
        if (!manualRowsContainer) return;

        manualRowsContainer.innerHTML = manualRows.map((row, idx) => {
            const rowNum = idx + 1;
            const hasEmpNo = Boolean(row.employee_number);
            const empBadgeText = hasEmpNo ? row.employee_number : "Auto";
            const empBadgeClass = hasEmpNo
                ? "sc-manual-empno-badge has-value"
                : "sc-manual-empno-badge";
            const nature = String(row.nature_of_service_credits || "").toUpperCase();

            return `
                <div class="sc-manual-item-row" data-manual-index="${idx}" role="row">
                    <span class="sc-manual-row-index">${rowNum}.</span>

                    <div
                        class="${empBadgeClass}"
                        data-manual-empno-badge="${idx}"
                        title="${escapeHtml(empBadgeText)}"
                    >
                        ${escapeHtml(empBadgeText)}
                    </div>

                    <div>
                        <select
                            class="sc-manual-select"
                            data-manual-field="employee_number"
                            aria-label="Row ${rowNum} Employee Name"
                        >
                            ${buildEmployeeOptionsHtml(row.employee_number)}
                        </select>
                    </div>

                    <div>
                        <input
                            type="text"
                            class="sc-manual-input"
                            data-manual-field="name_of_activity"
                            placeholder="Activity name"
                            value="${escapeHtml(row.name_of_activity)}"
                            aria-label="Row ${rowNum} Name of Activity"
                        >
                    </div>

                    <div>
                        <input
                            type="date"
                            class="sc-manual-input"
                            data-manual-field="activity_start_date"
                            value="${escapeHtml(row.activity_start_date)}"
                            aria-label="Row ${rowNum} Start Date"
                        >
                    </div>

                    <div>
                        <input
                            type="date"
                            class="sc-manual-input"
                            data-manual-field="activity_end_date"
                            value="${escapeHtml(row.activity_end_date)}"
                            aria-label="Row ${rowNum} End Date"
                        >
                    </div>

                    <div>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            class="sc-manual-input"
                            data-manual-field="number_of_service_credits"
                            placeholder="0.0"
                            value="${escapeHtml(row.number_of_service_credits)}"
                            aria-label="Row ${rowNum} Service Credits"
                        >
                    </div>

                    <div>
                        <select
                            class="sc-manual-select"
                            data-manual-field="nature_of_service_credits"
                            aria-label="Row ${rowNum} Credit Type"
                        >
                            <option value="" ${nature === "" ? "selected" : ""}>Select type</option>
                            <option value="LOCAL" ${nature === "LOCAL" ? "selected" : ""}>Local</option>
                            <option value="NATIONAL" ${nature === "NATIONAL" ? "selected" : ""}>National</option>
                            <option value="WELLNESS" ${nature === "WELLNESS" ? "selected" : ""}>Wellness</option>
                        </select>
                    </div>

                    <div>
                        <button
                            type="button"
                            class="btn-manual-remove"
                            data-manual-action="remove"
                            aria-label="Remove row ${rowNum}"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            `;
        }).join("");

        if (manualAddArea) {
            if (manualRows.length >= MAX_MANUAL_ROWS) {
                manualAddArea.style.display = "none";
            } else {
                manualAddArea.style.display = "flex";
                if (manualNextRowIndex) {
                    manualNextRowIndex.textContent = `${manualRows.length + 1}.`;
                }
            }
        }
    }

    if (manualRowsContainer) {
        manualRowsContainer.addEventListener("change", event => {
            const fieldEl = event.target.closest("[data-manual-field]");
            if (!fieldEl) return;

            const rowEl = fieldEl.closest("[data-manual-index]");
            if (!rowEl) return;

            const idx = Number(rowEl.dataset.manualIndex);
            const field = fieldEl.dataset.manualField;
            if (!manualRows[idx]) return;

            fieldEl.classList.remove("is-invalid");
            hideManualBanner();

            if (field === "employee_number") {
                const selectedEmpNo = fieldEl.value;
                const selectedOption = fieldEl.options[fieldEl.selectedIndex];
                const empDbName = selectedOption?.dataset?.employeeName || "";

                manualRows[idx].employee_number = selectedEmpNo;
                manualRows[idx].employee_name = empDbName;

                const badgeEl = rowEl.querySelector(`[data-manual-empno-badge="${idx}"]`);
                if (badgeEl) {
                    badgeEl.textContent = selectedEmpNo || "Auto";
                    badgeEl.title = selectedEmpNo || "Auto";
                    badgeEl.classList.toggle("has-value", Boolean(selectedEmpNo));
                }
            } else {
                manualRows[idx][field] = fieldEl.value;
            }
        });

        manualRowsContainer.addEventListener("input", event => {
            const fieldEl = event.target.closest("[data-manual-field]");
            if (!fieldEl) return;

            const rowEl = fieldEl.closest("[data-manual-index]");
            if (!rowEl) return;

            const idx = Number(rowEl.dataset.manualIndex);
            const field = fieldEl.dataset.manualField;
            if (!manualRows[idx] || field === "employee_number") return;

            fieldEl.classList.remove("is-invalid");
            manualRows[idx][field] = fieldEl.value;
        });

        manualRowsContainer.addEventListener("click", event => {
            const removeBtn = event.target.closest('[data-manual-action="remove"]');
            if (!removeBtn) return;

            const rowEl = removeBtn.closest("[data-manual-index]");
            if (!rowEl) return;

            const idx = Number(rowEl.dataset.manualIndex);
            hideManualBanner();

            if (manualRows.length <= 1) {
                manualRows[0] = createEmptyManualRow();
            } else {
                manualRows.splice(idx, 1);
            }

            renderManualUploadRows();
        });
    }

    if (btnAddManualPersonnel) {
        btnAddManualPersonnel.addEventListener("click", () => {
            hideManualBanner();

            if (manualRows.length >= MAX_MANUAL_ROWS) {
                showManualBanner("You can only add up to 5 personnel rows at a time.", "error");
                return;
            }

            manualRows.push(createEmptyManualRow());
            renderManualUploadRows();
        });
    }

    if (btnSubmitManualUpload) {
        btnSubmitManualUpload.addEventListener("click", async () => {
            hideManualBanner();

            const rowErrors = [];

            manualRows.forEach((row, idx) => {
                const rowNum = idx + 1;
                const rowEl = manualRowsContainer?.querySelector(`[data-manual-index="${idx}"]`);

                const markInvalid = fieldName => {
                    const inputEl = rowEl?.querySelector(`[data-manual-field="${fieldName}"]`);
                    if (inputEl) inputEl.classList.add("is-invalid");
                };

                if (!String(row.employee_number || "").trim()) {
                    rowErrors.push(`Row ${rowNum}: Please select an employee Name.`);
                    markInvalid("employee_number");
                }

                if (!String(row.name_of_activity || "").trim()) {
                    rowErrors.push(`Row ${rowNum}: Name of Activity is required.`);
                    markInvalid("name_of_activity");
                }

                if (!isValidDate(row.activity_start_date)) {
                    rowErrors.push(`Row ${rowNum}: Start Date is required.`);
                    markInvalid("activity_start_date");
                }

                if (!isValidDate(row.activity_end_date)) {
                    rowErrors.push(`Row ${rowNum}: End Date is required.`);
                    markInvalid("activity_end_date");
                }

                if (
                    isValidDate(row.activity_start_date) &&
                    isValidDate(row.activity_end_date) &&
                    row.activity_end_date < row.activity_start_date
                ) {
                    rowErrors.push(`Row ${rowNum}: End Date cannot be earlier than Start Date.`);
                    markInvalid("activity_end_date");
                }

                const credits = Number(row.number_of_service_credits);
                if (
                    row.number_of_service_credits === "" ||
                    !Number.isFinite(credits) ||
                    credits <= 0
                ) {
                    rowErrors.push(`Row ${rowNum}: Service Credits must be greater than 0.`);
                    markInvalid("number_of_service_credits");
                }

                const nature = String(row.nature_of_service_credits || "").toUpperCase();
                if (!["LOCAL", "NATIONAL", "WELLNESS"].includes(nature)) {
                    rowErrors.push(`Row ${rowNum}: Please select a Credit Type (Local, National, or Wellness).`);
                    markInvalid("nature_of_service_credits");
                }
            });

            if (rowErrors.length > 0) {
                showManualBanner(rowErrors[0], "error");
                return;
            }

            const confirmed = window.confirm(
                `Are you sure you want to upload ${manualRows.length} manual service credit record(s)?`
            );
            if (!confirmed) return;

            const originalText = btnSubmitManualUpload.textContent;
            try {
                btnSubmitManualUpload.disabled = true;
                btnSubmitManualUpload.textContent = "Uploading...";

                const result = await fetchJson(API.post, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        file_name: "Manual Upload",
                        rows: manualRows
                    })
                });

                showManualBanner(
                    result.message || `${result.posted_count} manual service credit record(s) uploaded.`,
                    "success"
                );

                manualRows = [createEmptyManualRow()];
                renderManualUploadRows();

                // Reload summary & Personnel Service Credits Records in real time
                await loadSummary();

            } catch (error) {
                console.error("Manual Service Credits Upload Error:", error);
                showManualBanner(
                    error.message || "Unable to upload manual service credits.",
                    "error"
                );
            } finally {
                btnSubmitManualUpload.disabled = false;
                btnSubmitManualUpload.textContent = originalText;
            }
        });
    }

    // --------------------------------------------------
    // 12. INITIAL PAGE LOAD
    // --------------------------------------------------

    renderManualUploadRows();
    wireActivitiesModal();
    loadSummary();
});
