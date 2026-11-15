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
        post: `${API_BASE}/admin/serviceCredits/post.php`,
        batchRecipients: `${API_BASE}/admin/serviceCredits/batchRecipients.php`
    };

    const HISTORY_ROWS_PER_PAGE = 15;
    const SC_RECIPIENTS_PER_PAGE = 5;

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

    const historyPagination = document.getElementById(
        "scHistoryPagination"
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

    // Upload history pagination & modal state.
    let uploadHistoryRecords = [];
    let uploadHistoryPage = 1;
    let scModalRecipients = [];
    let scModalPage = 1;

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
                        <td colspan="7" style="text-align:center;padding:32px;color:#9ca3af;font-style:italic;">
                            Unable to load upload history.
                        </td>
                    </tr>
                `;
            }
            if (historyPagination) {
                historyPagination.hidden = true;
            }
        }
    }

    function parseHistoryTimestamp(val) {
        if (!val) return 0;
        const d = new Date(String(val).replace(" ", "T"));
        const ms = d.getTime();
        return Number.isFinite(ms) ? ms : 0;
    }

    function renderUploadHistory(records) {
        const list = Array.isArray(records) ? [...records] : [];

        // Sort newest upload at the top
        list.sort((a, b) => {
            const timeA = parseHistoryTimestamp(a.uploaded_at) || parseHistoryTimestamp(a.posted_at);
            const timeB = parseHistoryTimestamp(b.uploaded_at) || parseHistoryTimestamp(b.posted_at);
            if (timeB !== timeA) return timeB - timeA;
            return Number(b.upload_batch_id || 0) - Number(a.upload_batch_id || 0);
        });

        uploadHistoryRecords = list;
        uploadHistoryPage = 1;
        renderUploadHistoryPage();
    }

    function renderUploadHistoryPage() {
        if (!historyBody) return;

        const total = uploadHistoryRecords.length;
        const totalPages = Math.max(1, Math.ceil(total / HISTORY_ROWS_PER_PAGE));
        uploadHistoryPage = Math.min(Math.max(1, uploadHistoryPage), totalPages);

        historyBody.replaceChildren();

        if (!total) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 7;
            td.style.cssText = "text-align:center;padding:32px;color:#9ca3af;font-style:italic;";
            td.textContent = "No service credit upload records found.";
            tr.appendChild(td);
            historyBody.appendChild(tr);

            if (historyPagination) {
                historyPagination.hidden = true;
            }
            return;
        }

        const start = (uploadHistoryPage - 1) * HISTORY_ROWS_PER_PAGE;
        const slice = uploadHistoryRecords.slice(start, start + HISTORY_ROWS_PER_PAGE);

        slice.forEach(record => {
            historyBody.appendChild(buildUploadHistoryRow(record));
        });

        renderUploadHistoryPagination(uploadHistoryPage, totalPages);
    }

    function buildUploadHistoryRow(rec) {
        const tr = document.createElement("tr");

        // Col 1: Upload Date
        const tdUploadDate = document.createElement("td");
        tdUploadDate.textContent = rec.uploaded_at || "—";

        // Col 2: File Name
        const tdFileName = document.createElement("td");
        const fileSpan = document.createElement("span");
        fileSpan.className = "sc-history-filename";
        fileSpan.textContent = rec.file_name || "—";
        tdFileName.appendChild(fileSpan);

        // Col 3: Uploaded By
        const tdUploadedBy = document.createElement("td");
        tdUploadedBy.textContent = rec.uploaded_by_name || "—";

        // Col 4: Records
        const tdRecords = document.createElement("td");
        tdRecords.textContent = String(rec.record_count ?? 0);

        // Col 5: Status
        const tdStatus = document.createElement("td");
        const statusPill = document.createElement("span");
        statusPill.className = "sc-status-posted";
        statusPill.textContent = String(rec.status || "POSTED").toUpperCase();
        tdStatus.appendChild(statusPill);

        // Col 6: Posted Date
        const tdPostedDate = document.createElement("td");
        tdPostedDate.textContent = rec.posted_at || "—";

        // Col 7: Actions (View button opens Service Credit Recipients modal)
        const tdActions = document.createElement("td");
        tdActions.className = "sc-actions-cell";
        const viewBtn = document.createElement("button");
        viewBtn.type = "button";
        viewBtn.className = "sc-inline-view";
        viewBtn.textContent = "View";
        viewBtn.addEventListener("click", () => openScRecipientsModal(rec));
        tdActions.appendChild(viewBtn);

        tr.append(
            tdUploadDate,
            tdFileName,
            tdUploadedBy,
            tdRecords,
            tdStatus,
            tdPostedDate,
            tdActions
        );

        return tr;
    }

    function renderUploadHistoryPagination(page, totalPages) {
        if (!historyPagination) return;
        historyPagination.replaceChildren();

        if (totalPages <= 1) {
            historyPagination.hidden = true;
            return;
        }
        historyPagination.hidden = false;

        const total = uploadHistoryRecords.length;
        const start = (page - 1) * HISTORY_ROWS_PER_PAGE + 1;
        const end = Math.min(page * HISTORY_ROWS_PER_PAGE, total);

        const info = document.createElement("span");
        info.className = "sc-pagination-info";
        info.textContent = `Showing ${start}–${end} of ${total}`;

        const group = document.createElement("div");
        group.className = "sc-pagination-btns";

        group.append(
            makeHistoryPagBtn("← Prev", page <= 1, () => {
                uploadHistoryPage--;
                renderUploadHistoryPage();
            }),
            ...buildHistoryPageRange(page, totalPages).map(p => {
                if (p === "…") {
                    const el = document.createElement("span");
                    el.className = "sc-page-ellipsis";
                    el.textContent = "…";
                    return el;
                }
                return makeHistoryPagBtn(
                    String(p),
                    false,
                    () => {
                        uploadHistoryPage = p;
                        renderUploadHistoryPage();
                    },
                    p === page
                );
            }),
            makeHistoryPagBtn("Next →", page >= totalPages, () => {
                uploadHistoryPage++;
                renderUploadHistoryPage();
            })
        );

        historyPagination.append(info, group);
    }

    function buildHistoryPageRange(current, total) {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
        const pages = [];
        const left = Math.max(2, current - 1);
        const right = Math.min(total - 1, current + 1);
        pages.push(1);
        if (left > 2) pages.push("…");
        for (let i = left; i <= right; i++) pages.push(i);
        if (right < total - 1) pages.push("…");
        pages.push(total);
        return pages;
    }

    function makeHistoryPagBtn(label, disabled, onClick, isActive = false) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = label;
        btn.disabled = disabled;
        btn.className = "sc-page-btn" + (isActive ? " sc-page-btn--active" : "");
        if (!disabled) btn.addEventListener("click", onClick);
        return btn;
    }

    // --------------------------------------------------
    // 4B. SERVICE CREDIT RECIPIENTS MODAL
    // --------------------------------------------------

    function setModalText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value ?? "—";
    }

    function wireScRecipientsModal() {
        const overlay = document.getElementById("scRecipientsModalOverlay");
        const closeBtn = document.getElementById("scRecipientsCloseBtn");
        const footerCloseBtn = document.getElementById("scRecipientsFooterCloseBtn");
        const prevBtn = document.getElementById("scRecipientsPrevBtn");
        const nextBtn = document.getElementById("scRecipientsNextBtn");

        closeBtn?.addEventListener("click", closeScRecipientsModal);
        footerCloseBtn?.addEventListener("click", closeScRecipientsModal);
        overlay?.addEventListener("click", event => {
            if (event.target === overlay) closeScRecipientsModal();
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && overlay?.classList.contains("is-open")) {
                closeScRecipientsModal();
            }
        });

        prevBtn?.addEventListener("click", () => {
            if (scModalPage > 1) {
                scModalPage--;
                renderScRecipientsModalPage();
            }
        });

        nextBtn?.addEventListener("click", () => {
            const totalPages = Math.max(
                1,
                Math.ceil(scModalRecipients.length / SC_RECIPIENTS_PER_PAGE)
            );
            if (scModalPage < totalPages) {
                scModalPage++;
                renderScRecipientsModalPage();
            }
        });
    }

    async function openScRecipientsModal(rec) {
        const overlay = document.getElementById("scRecipientsModalOverlay");
        const modal = document.getElementById("scRecipientsModal");
        const tbody = document.getElementById("scRecipientsTableBody");
        const pageInfo = document.getElementById("scRecipientsPageInfo");
        const prevBtn = document.getElementById("scRecipientsPrevBtn");
        const nextBtn = document.getElementById("scRecipientsNextBtn");

        if (!overlay || !modal) return;

        setModalText("scRecipientsFileName", rec.file_name || "—");
        setModalText("scRecipientsUploadDate", rec.uploaded_at || "—");

        scModalRecipients = [];
        scModalPage = 1;

        if (tbody) {
            tbody.innerHTML =
                `<tr><td colspan="5" style="text-align:center;padding:24px;color:#6b7280;">
                   Loading recipients...
                 </td></tr>`;
        }
        if (pageInfo) pageInfo.textContent = "Showing 0 of 0 records";
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;

        overlay.classList.add("is-open");
        document.body.style.overflow = "hidden";
        modal.focus();

        const batchId = Number(rec.upload_batch_id || 0);
        if (batchId <= 0) {
            renderScRecipientsEmpty("No recipient records found for this upload.");
            return;
        }

        try {
            const result = await fetchJson(
                `${API.batchRecipients}?upload_batch_id=${encodeURIComponent(batchId)}`
            );

            const batch = result.data?.batch;
            if (batch) {
                setModalText("scRecipientsFileName", batch.file_name || rec.file_name || "—");
                setModalText("scRecipientsUploadDate", batch.uploaded_at || rec.uploaded_at || "—");
            }

            scModalRecipients = Array.isArray(result.data?.recipients)
                ? result.data.recipients
                : [];
            scModalPage = 1;
            renderScRecipientsModalPage();
        } catch (error) {
            console.error("Batch recipients load error:", error);
            renderScRecipientsEmpty(
                error.message || "Unable to load service credit recipients."
            );
        }
    }

    function renderScRecipientsEmpty(message) {
        const tbody = document.getElementById("scRecipientsTableBody");
        const pageInfo = document.getElementById("scRecipientsPageInfo");
        const prevBtn = document.getElementById("scRecipientsPrevBtn");
        const nextBtn = document.getElementById("scRecipientsNextBtn");

        if (tbody) {
            tbody.replaceChildren();
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 5;
            td.style.cssText = "text-align:center;padding:24px;color:#9ca3af;font-style:italic;";
            td.textContent = message;
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        if (pageInfo) pageInfo.textContent = "Showing 0 of 0 records";
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
    }

    function renderScRecipientsModalPage() {
        const tbody = document.getElementById("scRecipientsTableBody");
        const pageInfo = document.getElementById("scRecipientsPageInfo");
        const prevBtn = document.getElementById("scRecipientsPrevBtn");
        const nextBtn = document.getElementById("scRecipientsNextBtn");

        if (!tbody) return;

        const total = scModalRecipients.length;
        if (total === 0) {
            renderScRecipientsEmpty("No employees received service credits in this upload.");
            return;
        }

        const totalPages = Math.max(1, Math.ceil(total / SC_RECIPIENTS_PER_PAGE));
        scModalPage = Math.min(Math.max(1, scModalPage), totalPages);

        const startIdx = (scModalPage - 1) * SC_RECIPIENTS_PER_PAGE;
        const endIdx = Math.min(startIdx + SC_RECIPIENTS_PER_PAGE, total);
        const slice = scModalRecipients.slice(startIdx, endIdx);

        tbody.replaceChildren();

        slice.forEach(item => {
            const tr = document.createElement("tr");

            const tdId = document.createElement("td");
            tdId.textContent = item.employee_number || "—";

            const tdName = document.createElement("td");
            tdName.textContent = item.employee_name || "—";

            const tdRole = document.createElement("td");
            tdRole.textContent = item.current_role || "—";

            const tdCreditType = document.createElement("td");
            tdCreditType.textContent = item.credit_type || "—";

            const tdCredits = document.createElement("td");
            const creditsSpan = document.createElement("span");
            creditsSpan.className = "sc-added-credits-val";
            const num = Number(item.credit_amount ?? 0);
            const formattedNum = Number.isFinite(num) ? num.toFixed(1) : "0.0";
            creditsSpan.textContent = `+${formattedNum} Credits`;
            tdCredits.appendChild(creditsSpan);

            tr.append(tdId, tdName, tdRole, tdCreditType, tdCredits);
            tbody.appendChild(tr);
        });

        if (pageInfo) {
            pageInfo.textContent = `Showing ${startIdx + 1}-${endIdx} of ${total} records`;
        }
        if (prevBtn) prevBtn.disabled = scModalPage <= 1;
        if (nextBtn) nextBtn.disabled = scModalPage >= totalPages;
    }

    function closeScRecipientsModal() {
        document.getElementById("scRecipientsModalOverlay")?.classList.remove("is-open");
        document.body.style.overflow = "";
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

    wireScRecipientsModal();
    loadSummary();
});
