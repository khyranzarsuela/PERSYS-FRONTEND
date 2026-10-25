  (function () {
    'use strict';

    /* -- Element refs ------------------------------------ */
    var toggle   = document.getElementById('employeesToggle');
    var submenu  = document.getElementById('employeesSubmenu');
    var caret    = document.getElementById('employeesCaret');
    var subBtns  = document.querySelectorAll('.submenu-item');
    var panels   = document.querySelectorAll('.emp-panel');

    /* -- 1. EMPLOYEES SUB-MENU TOGGLE -------------------- */
    // Open the sub-menu immediately on page load (Employees is active)
    openSubmenu();

    if (toggle) {
      toggle.addEventListener('click', function () {
        var isOpen = submenu.classList.contains('is-open');
        isOpen ? closeSubmenu() : openSubmenu();
      });
    }

    function openSubmenu() {
      if (!submenu) return;
      submenu.classList.add('is-open');
      if (caret) caret.classList.add('is-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
    }

    function closeSubmenu() {
      if (!submenu) return;
      submenu.classList.remove('is-open');
      if (caret) caret.classList.remove('is-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }

    /* -- 2. TEACHING / NON-TEACHING PANEL SWAP ----------- */
    subBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var targetPanel = this.dataset.panel;

        // Update sub-button active states
        subBtns.forEach(function (b) {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        this.classList.add('is-active');
        this.setAttribute('aria-pressed', 'true');

        // Show matching panel, hide others
        panels.forEach(function (panel) {
          if (panel.id === 'panel-' + targetPanel) {
            panel.classList.add('is-active');
          } else {
            panel.classList.remove('is-active');
          }
        });

        // Re-apply search filter whenever the panel changes
     //   filterRows();
      });
    });

    /* Search is handled by the pagination system below. */
  

  })();

  const dialog = document.getElementById('myDialog');
const openBtn = document.getElementById('openBtn');
const closeBtn = document.getElementById('closeBtn');

// Open the dialog when trigger is clicked

openBtn.addEventListener('click', function () {

    // Reset the previous upload session.
    resetMasterFileUpload();

    // Open a fresh Master File Upload dialog.
    myDialog.showModal();

});


// Close the dialog when close button is clicked
closeBtn.addEventListener('click', () => {
  dialog.close();
});


//   const createAccountDialog = document.getElementById('createAccountDialog');
// const openCreateAccountBtn = document.getElementById('openCreateAccount');
// const closeCreateAccountBtn = document.getElementById('closeCreateAccount');

// // Open the dialog when trigger is clicked
// openCreateAccountBtn.addEventListener('click', () => {
//   createAccountDialog.showModal(); 
// });

// // Close the dialog when close button is clicked
// closeCreateAccountBtn.addEventListener('click', () => {
//   createAccountDialog.close();
// });

/* =========================================================
   MASTER FILE — RESET UPLOAD FORM
   ========================================================= */

function resetMasterFileUpload() {

    const form = document.getElementById('masterFileForm');
    const preview = document.getElementById('masterFilePreview');
    const status = document.getElementById('masterFileStatus');

    // Clear the previously selected Excel file.
    if (form) {
        form.reset();
    }

    // Remove the previous Excel preview, including
    // validation results and the Save & Import button.
    if (preview) {
        preview.replaceChildren();
    }

    // Remove previous upload status messages.
    if (status) {
        status.textContent = '';
    }
}


    const selectedFile = document.getElementById('masterSelectedFile');
    const uploadButton = document.getElementById('btnUploadMaster');

    if (selectedFile) {
        selectedFile.textContent = 'No file selected';
    }

    if (uploadButton) {
        uploadButton.disabled = true;
    }


const createAccountDialog = document.getElementById('createAccountDialog');
const closeCreateAccountBtn = document.getElementById('closeCreateAccount');

// 1. Listen for clicks on ALL "Create Account" buttons across the table

/* =========================================================
   CREATE ACCOUNT — OPEN MODAL
   ========================================================= */

document.getElementById("accountsTableBody")
    ?.addEventListener("click", function (event) {

        const button = event.target.closest(".openCreateAccountBtn");

        if (!button || button.disabled) {
            return;
        }

        const empId = button.dataset.id;
        const empNumber = button.dataset.number;
        const empName = button.dataset.name;
        const empEmail = button.dataset.email;
        const empType = button.dataset.type;

        document.getElementById("modal_employee_id").value = empId;
        document.getElementById("employee_number").value = empNumber;
        document.getElementById("employee_name").value = empName;
        document.getElementById("deped_email").value = empEmail;

        document.getElementById("username").value = "";
        document.getElementById("password").value = "";

        const roleSelect = document.getElementById("role_id");
        roleSelect.value = "";

        roleSelect.querySelectorAll("option").forEach(function (option) {
            if (option.value === "" || option.value === "1") {
                option.hidden = false;
            } else if (option.value === "2") {
                option.hidden = empType !== "Teaching";
            } else if (option.value === "3") {
                option.hidden = empType !== "Non-Teaching";
            }
        });

        createAccountDialog.showModal();
    });


// 6. Close dialog handler
closeCreateAccountBtn.addEventListener('click', () => {
    createAccountDialog.close();
});


//FILE UPLOAD
const masterFileForm = document.getElementById('masterFileForm');
const masterFileStatus = document.getElementById('masterFileStatus');
const masterFilePreview = document.getElementById('masterFilePreview');
const uploadMasterButton = document.getElementById('btnUploadMaster');


const masterFileInput = document.getElementById('fileUpload');
const masterSelectedFile = document.getElementById('masterSelectedFile');

masterFileInput.addEventListener('change', function () {
    const file = this.files?.[0];

    if (!file) {
        masterSelectedFile.textContent = 'No file selected';
        uploadMasterButton.disabled = true;
        return;
    }

    masterSelectedFile.textContent = 'Selected: ' + file.name;

    const validExtension = /\.(xlsx|xls)$/i.test(file.name);

    uploadMasterButton.disabled = !validExtension;

    if (!validExtension) {
        masterSelectedFile.textContent =
            'Unsupported file format. Please select an Excel file.';
    }
});



masterFileForm.addEventListener('submit', function (event) {

    event.preventDefault();

    const formData = new FormData(masterFileForm);

    masterFileStatus.textContent = 'Reading Excel file...';
    masterFilePreview.innerHTML = '';

    uploadMasterButton.disabled = true;


    fetch('http://localhost/PERSYS-BACKEND/api/admin/uploadMasterFile.php', {
        method: 'POST',
        body: formData,
        credentials: 'include'
    })

    .then(function (response) {

        return response.json();

    })

    .then(function (data) {

        if (!data.success) {

            masterFileStatus.textContent =
                data.message || 'The Excel file could not be processed.';

            return;
        }


        masterFileStatus.textContent =
            'Excel file successfully read: ' + data.file_name;


        renderMasterFilePreview(data);

    })

    .catch(function (error) {

        console.error(error);

        masterFileStatus.textContent =
            'An error occurred while processing the Excel file.';

    })

    .finally(function () {

     const hasValidFile = masterFileInput.files.length > 0 &&
        /\.(xlsx|xls)$/i.test(masterFileInput.files[0].name);

    uploadMasterButton.disabled = !hasValidFile;


    });

});

function renderMasterFilePreview(data) {

    if (!data.rows || data.rows.length === 0) {

        masterFilePreview.innerHTML = `
            <p style="text-align:center;">
                No employee records were found in the Excel file.
            </p>
        `;

        return;
    }


    let html = `

        <div class="import-summary">

            <strong>${data.total_records}</strong>
            records found

            &nbsp; | &nbsp;

            <strong>${data.valid_count}</strong>
            valid

            &nbsp; | &nbsp;

            <strong>${data.invalid_count}</strong>
            invalid

        </div>


        <div class="import-table-wrap">

            <table class="emp-table import-preview-table">

                <thead>

                    <tr>
                        <th>#</th>
                        <th>Employee Number</th>
                        <th>Last Name</th>
                        <th>First Name</th>
                        <th>Middle Name</th>
                        <th>Plantilla Item Number</th>
                        <th>Position</th>
                        <th>Salary Grade</th>
                        <th>Step Increment</th>
                        <th>Original Appointment</th>
                        <th>Last Promotion</th>
                        <th>DepEd Email</th>
                        <th>Personnel Type</th>
                        <th>Status</th>
                    </tr>

                </thead>

                <tbody>
    `;


    data.rows.forEach(function (row, index) {

        const isValid = row.status === 'valid';

        const statusText = isValid
            ? '✓ Valid'
            : '✗ Invalid';


        const errorText = row.errors && row.errors.length
            ? row.errors.map(escapeHtml).join('<br>')
            : '';


        html += `

            <tr
                class="${isValid ? 'import-valid' : 'import-invalid'}"
                data-excel-row="${row.excel_row}"
            >

                <td>
                    ${index + 1}
                </td>


                <!-- Employee Number -->
                <td>
                    <input
                        type="text"
                        class="import-input"
                        data-field="employee_number"
                        value="${escapeHtml(row.employee_number)}"
                    >
                </td>


                <!-- Last Name -->
                <td>
                    <input
                        type="text"
                        class="import-input"
                        data-field="last_name"
                        value="${escapeHtml(row.last_name)}"
                    >
                </td>


                <!-- First Name -->
                <td>
                    <input
                        type="text"
                        class="import-input"
                        data-field="first_name"
                        value="${escapeHtml(row.first_name)}"
                    >
                </td>


                <!-- Middle Name -->
                <td>
                    <input
                        type="text"
                        class="import-input"
                        data-field="middle_name"
                        value="${escapeHtml(row.middle_name)}"
                    >
                </td>


                <!-- Plantilla Item Number -->
                <td>
                    <input
                        type="text"
                        class="import-input"
                        data-field="plantilla_item_number"
                        value="${escapeHtml(row.plantilla_item_number)}"
                    >
                </td>


                <!-- Position -->
                <td>
                    <input
                        type="text"
                        class="import-input"
                        data-field="position"
                        value="${escapeHtml(row.position)}"
                    >
                </td>


                <!-- Salary Grade -->
                <td>
                    <input
                        type="number"
                         min="0"
                        class="import-input"
                        data-field="salary_grade"
                        value="${escapeHtml(row.salary_grade)}"
                    >
                </td>


                <!-- Step Increment -->
                <td>
                    <input
                        type="number"
                         min="0" 
                        class="import-input"
                        data-field="step_increment"
                        value="${escapeHtml(row.step_increment)}"
                    >
                </td>


                <!-- Original Appointment -->
                <td>
                    <input
                        type="date"
                        class="import-input"
                        data-field="date_original_appointment"
                        value="${escapeHtml(row.date_original_appointment || '')}"
                    >
                </td>


                <!-- Last Promotion -->
                <td>
                    <input
                        type="date"
                        class="import-input"
                        data-field="date_last_promotion"
                        value="${escapeHtml(row.date_last_promotion || '')}"
                    >
                </td>


                <!-- DepEd Email -->
                <td>
                    <input
                        type="email"
                        class="import-input"
                        data-field="deped_email"
                        value="${escapeHtml(row.deped_email)}"
                    >
                </td>


                <!-- Personnel Type -->
                <td>

                    <select
                        class="import-input"
                        data-field="personnel_type"
                    >

                        <option
                            value="Teaching"
                            ${row.personnel_type === 'Teaching' ? 'selected' : ''}
                        >
                            Teaching
                        </option>

                        <option
                            value="Non-Teaching"
                            ${row.personnel_type === 'Non-Teaching' ? 'selected' : ''}
                        >
                            Non-Teaching
                        </option>

                    </select>

                </td>


                <!-- Status -->
                <td>

                    <strong class="import-status">
                        ${statusText}
                    </strong>

                    ${
                        errorText
                            ? `<div class="import-errors">${errorText}</div>`
                            : ''
                    }

                </td>

            </tr>
        `;
    });


    html += `

                </tbody>

            </table>

        </div>


        <div style="
            display:flex;
            justify-content:flex-end;
            margin-top:16px;
            gap:10px;
        ">

            <button
                type="button"
                class="btn-filter"
                id="btnSaveMasterFile"
            >
                Save & Import
            </button>

        </div>
    `;


    masterFilePreview.innerHTML = html;
}

function collectMasterFileData() {

    const rows = [];

    const tableRows = masterFilePreview.querySelectorAll(
        'tbody tr[data-excel-row]'
    );


    tableRows.forEach(function (tableRow) {

        const row = {
            excel_row: tableRow.dataset.excelRow
        };


        const inputs = tableRow.querySelectorAll(
            '[data-field]'
        );


        inputs.forEach(function (input) {

            const field = input.dataset.field;

            row[field] = input.value.trim();

        });


        rows.push(row);

    });


    return rows;
}


/* =========================================================
   MASTER FILE — NOTIFICATION HANDLER
   ========================================================= */

function showMasterFileNotification(type, title, message) {

    const dialog = document.getElementById(
        'masterFileNotificationDialog'
    );

    const icon = document.getElementById(
        'masterFileNotificationIcon'
    );

    const titleElement = document.getElementById(
        'masterFileNotificationTitle'
    );

    const messageElement = document.getElementById(
        'masterFileNotificationMessage'
    );

    if (!dialog) {
        console.error('Master File notification dialog not found.');
        return;
    }

    const isError = type === 'error';

    dialog.classList.toggle('is-error', isError);

    //check icon or x icon
    
    const iconColor = isError ? "#D06079" : "#22A55A";

    const symbol = isError
        ? `
            <line class="persys-result-line"
                  x1="34.4" y1="37.9"
                  x2="95.8" y2="92.3" />

            <line class="persys-result-line"
                  x1="95.8" y1="38"
                  x2="34.4" y2="92.2" />
          `
        : `
            <polyline class="persys-result-check"
                      points="100.2,40.2 51.5,88.8 29.8,67.5" />
          `;

    icon.innerHTML = `
        <svg class="persys-result-svg"
             viewBox="0 0 130.2 130.2"
             xmlns="http://www.w3.org/2000/svg"
             aria-hidden="true">

            <circle class="persys-result-circle"
                    cx="65.1"
                    cy="65.1"
                    r="62.1" />

            ${symbol}

        </svg>
    `;

    icon.style.setProperty("--result-color", iconColor);

    titleElement.textContent = title;
    messageElement.textContent = message;

    if (!dialog.open) {
        dialog.showModal();
    }
}

document.getElementById('closeMasterFileNotification')
    ?.addEventListener('click', function () {

        document.getElementById(
            'masterFileNotificationDialog'
        ).close();

    });



/* =========================================================
   MASTER FILE — SAVE & IMPORT
   ========================================================= */

masterFilePreview.addEventListener('click', async function (event) {

    const saveButton = event.target.closest('#btnSaveMasterFile');

    if (!saveButton || saveButton.disabled) {
        return;
    }

    const editedRows = collectMasterFileData();

    if (!editedRows.length) {
        showMasterFileNotification(
            'error',
            'No Records Found',
            'There are no employee records to import.'
        );
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Importing...';

    try {

        const response = await fetch(
            'http://localhost/PERSYS-BACKEND/api/admin/saveMasterFile.php',
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    rows: editedRows
                })
            }
        );

        // Preserve existing session/error handling.
        const checkedResponse =
            await window.PERSYSApiErrors.handleResponse(response);

        if (!checkedResponse) {
            return;
        }

        const data = await checkedResponse.json();

        if (!response.ok || !data.success) {

            let message = data.message ||
                'The employee records could not be imported.';

            if (Array.isArray(data.invalid_rows) &&
                data.invalid_rows.length > 0) {

                const details = data.invalid_rows
                    .slice(0, 5)
                    .map(function (row) {

                        const errors = Array.isArray(row.errors)
                            ? row.errors.join(', ')
                            : 'Invalid employee record.';

                        return 'Row ' + row.row + ': ' + errors;
                    })
                    .join('\n');

                message += '\n\n' + details;

                if (data.invalid_rows.length > 5) {
                    message += '\nAdditional invalid rows were found.';
                }
            }

            showMasterFileNotification(
                'error',
                'Import Failed',
                message
            );

            return;
        }

        // Correct field: inserted_count, not received_count.
        const insertedCount = Number(data.inserted_count);

        showMasterFileNotification(
            'success',
            'Import Successful',
            `${insertedCount} employee record(s) have been successfully imported into PERSYS.`
        );

        // Prevent the same batch from being submitted twice.
        saveButton.remove();

        // Refresh employee records without refreshing the page.
        await loadEmployeeRecords();

    } catch (error) {

        console.error('Master File Import Error:', error);

        if (window.PERSYSApiErrors?.handleNetworkError &&
            error instanceof TypeError) {

            window.PERSYSApiErrors.handleNetworkError(error);

        } else {

            showMasterFileNotification(
                'error',
                'Import Error',
                'An unexpected error occurred while importing employee records.'
            );
        }

    } finally {

        if (saveButton.isConnected) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save & Import';
        }

    }

});



function escapeHtml(value) {

    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ── ADD EMPLOYEE MODAL ──────────────────────────────────────────────── */
var addEmpDialog   = document.getElementById('addEmployeeDialog');
var openAddEmpBtn  = document.querySelector('.btn-add-employee');
var closeAddEmpBtn = document.getElementById('closeAddEmployee');

// Note: openAddEmpBtn matches the first .btn-add-employee (the toolbar "+ Add Employee" button).
// The "Master File Upload" button uses id="openBtn" and is wired separately above.
if (openAddEmpBtn && addEmpDialog) {
    openAddEmpBtn.addEventListener('click', function() {
        document.getElementById('addEmployeeForm').reset();
        addEmpDialog.showModal();
    });
}
if (closeAddEmpBtn) {
    closeAddEmpBtn.addEventListener('click', function() {
        addEmpDialog.close();
    });
}

/* ── SUCCESS DIALOG CLOSE ────────────────────────────────────────────── */
var closeSuccessBtn = document.getElementById('closeSuccessDialog');
if (closeSuccessBtn) {
    closeSuccessBtn.addEventListener('click', function() {
        document.getElementById('successAddDialog').close();
        var url = new URL(window.location.href);
        url.searchParams.delete('added');
        window.history.replaceState({}, '', url.toString());
    });
}

//

/* =========================================================
   PERSYS — EMPLOYEE RECORDS API
   ========================================================= */

const EMPLOYEES_API =
  "http://localhost/PERSYS-BACKEND/api/admin/employees.php";

document.addEventListener("DOMContentLoaded", async () => {
  const authorized = await window.PERSYSAdminGuard.ready;

  if (!authorized) {
    return;
  }

  loadAdminSidebar();
  loadEmployeeRecords();
});

async function loadEmployeeRecords() {
  try {
    let response;

    try {
      response = await fetch(EMPLOYEES_API, {
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

    if (!result.success) {
      throw new Error(result.message || "Unable to load employees.");
    }

    const data = result.data;

    renderPersonnelTable(
      data.teaching,
      "teachingTableBody",
      "No teaching employee records found."
    );

    renderPersonnelTable(
      data.non_teaching,
      "nonTeachingTableBody",
      "No non-teaching employee records found."
    );

    renderAccountsTable(data.accounts);

  } catch (error) {
    console.error("Employee records error:", error);

    showTableMessage("teachingTableBody", 11, "Unable to load records.");
    showTableMessage("nonTeachingTableBody", 11, "Unable to load records.");
    showTableMessage("accountsTableBody", 6, "Unable to load records.");
  }
}


/* =========================================================
   EMPLOYEE MANAGEMENT — PAGINATION AND SEARCH
   ========================================================= */

const employeeTableState = {
    teaching: {
        records: [],
        page: 1,
        perPage: 5,
        tbodyId: "teachingTableBody",
        paginationId: "teachingPagination",
        emptyMessage: "No teaching employee records found."
    },
    nonTeaching: {
        records: [],
        page: 1,
        perPage: 5,
        tbodyId: "nonTeachingTableBody",
        paginationId: "nonTeachingPagination",
        emptyMessage: "No non-teaching employee records found."
    },
    accounts: {
        records: [],
        page: 1,
        perPage: 5,
        tbodyId: "accountsTableBody",
        paginationId: "accountsPagination",
        emptyMessage: "No account records found."
    }
};

function renderPersonnelTable(employees, tableBodyId, emptyMessage) {
    const type = tableBodyId === "teachingTableBody"
        ? "teaching"
        : "nonTeaching";

    const state = employeeTableState[type];

    state.records = Array.isArray(employees) ? employees : [];
    state.emptyMessage = emptyMessage;

    renderEmployeePage(type);
}

function renderAccountsTable(employees) {
    employeeTableState.accounts.records =
        Array.isArray(employees) ? employees : [];

    renderEmployeePage("accounts");
}

function getFilteredEmployeeRecords(type) {
    const state = employeeTableState[type];
    const searchInput = document.getElementById("empSearch");
    const term = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    if (!term) {
        return state.records;
    }

    return state.records.filter(function (employee) {
        const fullName = [
            employee.first_name,
            employee.middle_name,
            employee.last_name
        ].filter(Boolean).join(" ");

        const searchableValues = [
            employee.employee_number,
            fullName,
            employee.last_name,
            employee.first_name,
            employee.middle_name,
            employee.plantilla_item_number,
            employee.position,
            employee.salary_grade,
            employee.step_increment,
            employee.date_original_appointment,
            employee.date_last_promotion,
            formatEmployeeDate(employee.date_original_appointment),
            formatEmployeeDate(employee.date_last_promotion),
            employee.deped_email,
            employee.personnel_type,
            employee.username,
            employee.role_name,
            employee.account_id === null
                ? "No Account"
                : Number(employee.is_active) === 1
                    ? "Active"
                    : "Inactive"
        ];

        return searchableValues.some(function (value) {
            return String(value ?? "")
                .toLowerCase()
                .includes(term);
        });
    });
}

function renderEmployeePage(type) {
    const state = employeeTableState[type];
    const tbody = document.getElementById(state.tbodyId);

    if (!tbody) return;

    const records = getFilteredEmployeeRecords(type);
    const totalPages = Math.max(
        1,
        Math.ceil(records.length / state.perPage)
    );

    state.page = Math.min(
        Math.max(state.page, 1),
        totalPages
    );

    const startIndex = (state.page - 1) * state.perPage;
    const visibleRecords = records.slice(
        startIndex,
        startIndex + state.perPage
    );

    tbody.replaceChildren();

    if (visibleRecords.length === 0) {
        const searchTerm = document
            .getElementById("empSearch")
            ?.value.trim();

        showTableMessage(
            state.tbodyId,
            type === "accounts" ? 6 : 11,
            searchTerm
                ? "No matching employee records found."
                : state.emptyMessage
        );
    } else {
        visibleRecords.forEach(function (employee) {
            if (type === "accounts") {
                appendAccountRow(tbody, employee);
            } else {
                appendPersonnelRow(tbody, employee);
            }
        });
    }

    renderEmployeePagination(type, records.length, totalPages);
}


function appendPersonnelRow(tbody, employee) {
    const tr = document.createElement("tr");

    const values = [
        employee.last_name,
        employee.first_name,
        employee.middle_name,
        employee.plantilla_item_number,
        employee.position,
        employee.salary_grade,
        employee.step_increment,
        formatEmployeeDate(employee.date_original_appointment),
        formatEmployeeDate(employee.date_last_promotion),
        employee.deped_email
    ];

    values.forEach(function (value) {
        const td = document.createElement("td");
        td.textContent = value ?? "";
        tr.appendChild(td);
    });

    // Edit Employee action
    const actionCell = document.createElement("td");
    const editButton = document.createElement("button");

    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.className = "btn-add-employee openEditEmployeeBtn";
    editButton.dataset.employeeId = employee.employee_id;
    editButton.title = "Edit employee information";

    actionCell.appendChild(editButton);
    tr.appendChild(actionCell);

    tbody.appendChild(tr);
}


function appendAccountRow(tbody, employee) {
    const tr = document.createElement("tr");

    const fullName = [
        employee.first_name,
        employee.middle_name,
        employee.last_name
    ].filter(Boolean).join(" ");

    let accountStatus = "No Account";

    if (employee.account_id !== null) {
        accountStatus =
            Number(employee.is_active) === 1
                ? "Active"
                : "Inactive";
    }

    const values = [
        employee.employee_number,
        fullName,
        employee.personnel_type,
        employee.deped_email,
        accountStatus
    ];

    values.forEach(function (value) {
        const td = document.createElement("td");
        td.textContent = value ?? "";
        tr.appendChild(td);
    });

    const actionCell = document.createElement("td");
    const actionButton = document.createElement("button");

    actionButton.type = "button";
    actionButton.textContent =
        employee.account_id === null ? "Create Account" : "View";
    actionButton.className = "btn-add-employee";

    // Account actions will be migrated in the next step.
   
if (employee.account_id === null) {
    actionButton.classList.add("openCreateAccountBtn");

    actionButton.dataset.id = employee.employee_id;
    actionButton.dataset.number = employee.employee_number;
    actionButton.dataset.name = fullName;
    actionButton.dataset.email = employee.deped_email;
    actionButton.dataset.type = employee.personnel_type;
} 
else {
    actionButton.classList.add("openViewAccountBtn");
    actionButton.dataset.employeeId = employee.employee_id;
    actionButton.title = "View employee account information";
}


    actionCell.appendChild(actionButton);
    tr.appendChild(actionCell);

    tbody.appendChild(tr);
}

function renderEmployeePagination(type, totalRecords, totalPages) {
    const state = employeeTableState[type];
    const container = document.getElementById(state.paginationId);

    if (!container) return;

    container.replaceChildren();

    const info = document.createElement("span");
    info.className = "pagination-info";

    const start = totalRecords === 0
        ? 0
        : (state.page - 1) * state.perPage + 1;

    const end = Math.min(
        state.page * state.perPage,
        totalRecords
    );

    info.textContent =
        `Showing ${start}–${end} of ${totalRecords} records`;

    const controls = document.createElement("div");
    controls.className = "pagination-controls";

    const perPageLabel = document.createElement("label");
    perPageLabel.textContent = "Rows per page: ";

    const perPageSelect = document.createElement("select");
    perPageSelect.className = "pagination-select";

    [5, 10, 20].forEach(function (amount) {
        const option = document.createElement("option");
        option.value = amount;
        option.textContent = amount;
        option.selected = state.perPage === amount;
        perPageSelect.appendChild(option);
    });

    perPageSelect.addEventListener("change", function () {
        state.perPage = Number(this.value);
        state.page = 1;
        renderEmployeePage(type);
    });

    perPageLabel.appendChild(perPageSelect);
    controls.appendChild(perPageLabel);

    const previousButton = createPaginationButton(
        "‹",
        state.page === 1,
        function () {
            state.page--;
            renderEmployeePage(type);
        }
    );

    previousButton.setAttribute("aria-label", "Previous page");
    controls.appendChild(previousButton);

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        const button = createPaginationButton(
            String(pageNumber),
            false,
            function () {
                state.page = pageNumber;
                renderEmployeePage(type);
            }
        );

        if (pageNumber === state.page) {
            button.classList.add("is-active");
            button.setAttribute("aria-current", "page");
        }

        controls.appendChild(button);
    }

    const nextButton = createPaginationButton(
        "›",
        state.page === totalPages,
        function () {
            state.page++;
            renderEmployeePage(type);
        }
    );

    nextButton.setAttribute("aria-label", "Next page");
    controls.appendChild(nextButton);

    container.appendChild(info);
    container.appendChild(controls);
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

/* Search across all loaded employee records */
document.getElementById("empSearch")
    ?.addEventListener("input", function () {
        Object.keys(employeeTableState).forEach(function (type) {
            employeeTableState[type].page = 1;
            renderEmployeePage(type);
        });
    });



/* =========================================================
   HELPERS
   ========================================================= */

function formatEmployeeDate(value) {
  if (!value) return "None";

  const parts = String(value).slice(0, 10).split("-");

  if (parts.length !== 3) {
    return String(value);
  }

  const [year, month, day] = parts;

  return `${month}/${day}/${year.slice(-2)}`;
}

function showTableMessage(tableBodyId, colspan, message) {
  const tbody = document.getElementById(tableBodyId);
  if (!tbody) return;

  tbody.replaceChildren();

  const tr = document.createElement("tr");
  const td = document.createElement("td");

  td.colSpan = colspan;
  td.style.textAlign = "center";
  td.textContent = message;

  tr.appendChild(td);
  tbody.appendChild(tr);
}


async function loadAdminSidebar() {
  try {
    const response = await fetch(
      "http://localhost/PERSYS-BACKEND/api/auth/me.php",
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      }
    );

    const checkedResponse =
      await window.PERSYSApiErrors.handleResponse(response);

    if (!checkedResponse) return;

    const result = await checkedResponse.json();

    if (!result.success) {
      throw new Error(result.message || "Unable to load Admin details.");
    }

    const sessionData = result.data;

    document.getElementById("adminUsername").textContent =
      sessionData.username;

    document.getElementById("adminRole").textContent =
      sessionData.role_name;

  } catch (error) {
    console.error("Admin sidebar loading error:", error);
  }
}


/* =========================================================
   PERSYS — MANUAL ADD EMPLOYEE
   ========================================================= */

const ADD_EMPLOYEE_API =
  "http://localhost/PERSYS-BACKEND/api/admin/addEmployee.php";

const addEmployeeForm = document.getElementById("addEmployeeForm");

if (addEmployeeForm) {
  addEmployeeForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!addEmployeeForm.reportValidity()) {
      return;
    }

    const submitButton =
      addEmployeeForm.querySelector('[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      let response;

      try {
        response = await fetch(ADD_EMPLOYEE_API, {
          method: "POST",
          credentials: "include",
          body: new FormData(addEmployeeForm),
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

            showMasterFileNotification(
                "error",
                "Employee Not Added",
                result.message ||
                    "Unable to add employee. Please check the information and try again."
            );

            return;
        }


      // Close Add Employee modal.
      const addDialog = document.getElementById("addEmployeeDialog");

      if (addDialog?.open) {
        addDialog.close();
      }

      // Reset form for next use.
      addEmployeeForm.reset();

      // Refresh Teaching, Non-Teaching, and Accounts tables.
      await loadEmployeeRecords();

      // Show the existing success dialog.
      const successDialog =
        document.getElementById("successAddDialog");

      
        if (successDialog && !successDialog.open) {

            successDialog.showModal();

        } else {

            showMasterFileNotification(
                "success",
                "Employee Added",
                "The employee has been successfully added and is now available in the employee records."
            );

        }


    } catch (error) {
      console.error("Add Employee error:", error);

      showMasterFileNotification(
        "error",
        "Employee Creation Error",
        "An unexpected error occurred while adding the employee. Please try again."
    );

    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}


/* =========================================================
   PERSYS — CREATE ACCOUNT API
   ========================================================= */

const CREATE_ACCOUNT_API =
    "http://localhost/PERSYS-BACKEND/api/admin/createAccount.php";

const createAccountForm = document.getElementById("createAccountForm");

if (createAccountForm) {
    createAccountForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!createAccountForm.reportValidity()) {
            return;
        }

        const submitButton =
            createAccountForm.querySelector('[type="submit"]');

        if (submitButton?.disabled) return;

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Creating Account...";
        }

        try {
            const response = await fetch(CREATE_ACCOUNT_API, {
                method: "POST",
                credentials: "include",
                headers: {
                    Accept: "application/json"
                },
                body: new FormData(createAccountForm)
            });

            const checkedResponse =
                await window.PERSYSApiErrors.handleResponse(response);

            if (!checkedResponse) return;

            const data = await checkedResponse.json();

            if (!response.ok || !data.success) {
                createAccountDialog.close();

                showMasterFileNotification(
                    "error",
                    "Account Creation Failed",
                    data.message || "Unable to create the employee account."
                );
                return;
            }

            createAccountDialog.close();
            createAccountForm.reset();

            // Refresh Accounts table after successful creation.
            await loadEmployeeRecords();

            showMasterFileNotification(
                "success",
                "Account Created",
                "The employee account has been successfully created."
            );

        } catch (error) {
            console.error("Create Account Error:", error);

            if (error instanceof TypeError &&
                window.PERSYSApiErrors?.handleNetworkError) {
                window.PERSYSApiErrors.handleNetworkError(error);
            } else {
                createAccountDialog.close();

                showMasterFileNotification(
                    "error",
                    "Account Creation Error",
                    "An unexpected error occurred. Please try again."
                );
            }

        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Create Account";
            }
        }
    });
}


/* =========================================================
   PERSYS — VIEW ACCOUNT (READ ONLY)
   ========================================================= */

const viewAccountDialog =
    document.getElementById("viewAccountDialog");

const closeViewAccountButton =
    document.getElementById("closeViewAccount");

document.getElementById("accountsTableBody")
    ?.addEventListener("click", function (event) {

        const button = event.target.closest(".openViewAccountBtn");

        if (!button || button.disabled) return;

        const employeeId = button.dataset.employeeId;

        // Find the selected employee in the existing API records.
        const employee = employeeTableState.accounts.records.find(
            record => String(record.employee_id) === String(employeeId)
        );

        if (!employee) {
            showMasterFileNotification(
                "error",
                "Account Not Found",
                "The selected employee account could not be found."
            );
            return;
        }

        const fullName = [
            employee.first_name,
            employee.middle_name,
            employee.last_name
        ].filter(Boolean).join(" ");

        const accountStatus =
            Number(employee.is_active) === 1
                ? "Active"
                : "Inactive";

        // Personal Information
        document.getElementById("viewEmployeeNumber").textContent =
            employee.employee_number || "—";

        document.getElementById("viewPersonnelType").textContent =
            employee.personnel_type || "—";

        document.getElementById("viewEmployeeName").textContent =
            fullName || "—";

        document.getElementById("viewDepedEmail").textContent =
            employee.deped_email || "—";

        // Account Information
        document.getElementById("viewUsername").textContent =
            employee.username || "—";

        document.getElementById("viewRole").textContent =
            employee.role_name || "—";

        const statusElement =
            document.getElementById("viewAccountStatus");

        statusElement.textContent = accountStatus;

        statusElement.classList.toggle(
            "account-status-active",
            accountStatus === "Active"
        );

        statusElement.classList.toggle(
            "account-status-inactive",
            accountStatus === "Inactive"
        );

        const createdAtElement =
    document.getElementById("viewAccountCreatedAt");

const createdAt = employee.account_created_at;

if (createdAt) {
    // MySQL DATETIME format: YYYY-MM-DD HH:MM:SS
    const match = String(createdAt).match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
    );

    if (match) {
        const [, year, month, day, hour, minute, second] = match;

        const date = new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second)
        );

        createdAtElement.textContent =
            date.toLocaleString("en-PH", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true
            });
    } else {
        createdAtElement.textContent = "Date unavailable";
    }
} else {
    createdAtElement.textContent = "Date unavailable";
}

        viewAccountDialog.showModal();
    });

closeViewAccountButton?.addEventListener("click", function () {
    viewAccountDialog.close();
});


/* =========================================================
   PERSYS — EDIT EMPLOYEE MODAL
   ========================================================= */

const editEmployeeDialog =
    document.getElementById("editEmployeeDialog");

const editEmployeeForm =
    document.getElementById("editEmployeeForm");

function openEditEmployee(employee) {

    editEmployeeForm.reset();

    const fields = {
        ee_employee_id: employee.employee_id,
        ee_employee_number: employee.employee_number,
        ee_last_name: employee.last_name,
        ee_first_name: employee.first_name,
        ee_middle_name: employee.middle_name,
        ee_personnel_type: employee.personnel_type,
        ee_plantilla: employee.plantilla_item_number,
        ee_position: employee.position,
        ee_salary_grade: employee.salary_grade,
        ee_step_increment: employee.step_increment,
        ee_date_orig: employee.date_original_appointment,
        ee_date_promo: employee.date_last_promotion,
        ee_deped_email: employee.deped_email
    };

    Object.entries(fields).forEach(function ([id, value]) {
        const input = document.getElementById(id);

        if (input) {
            input.value = value ?? "";
        }
    });

    editEmployeeDialog.showModal();
}

// Event delegation supports pagination and search.
["teachingTableBody", "nonTeachingTableBody"].forEach(
    function (tableBodyId) {

        document.getElementById(tableBodyId)
            ?.addEventListener("click", function (event) {

                const button =
                    event.target.closest(".openEditEmployeeBtn");

                if (!button) return;

                const employeeId = button.dataset.employeeId;

                // Find the record from the loaded employee data.
                const allEmployees = [
                    ...employeeTableState.teaching.records,
                    ...employeeTableState.nonTeaching.records
                ];

                const employee = allEmployees.find(function (record) {
                    return String(record.employee_id) === String(employeeId);
                });

                if (!employee) {
                    showMasterFileNotification(
                        "error",
                        "Employee Not Found",
                        "The selected employee record could not be found."
                    );
                    return;
                }

                openEditEmployee(employee);
            });
    }
);

document.getElementById("closeEditEmployee")
    ?.addEventListener("click", function () {
        editEmployeeDialog.close();
    });

    
/* =========================================================
   PERSYS — SAVE EMPLOYEE UPDATES
   ========================================================= */

editEmployeeForm?.addEventListener("submit", async function (event) {
    event.preventDefault();

    const saveButton = document.getElementById("saveEditEmployee");

    if (saveButton.disabled) {
        return;
    }

    // Collect edited employee information.
    const formData = new FormData(editEmployeeForm);

    saveButton.disabled = true;
    saveButton.textContent = "Saving Changes...";

    try {
        const response = await fetch(
            "http://localhost/PERSYS-BACKEND/api/admin/updateEmployee.php",
            {
                method: "POST",
                credentials: "include",
                body: formData,
                headers: {
                    Accept: "application/json"
                }
            }
        );

        // Preserve existing PERSYS session/error handling.
        const checkedResponse =
            await window.PERSYSApiErrors.handleResponse(response);

        if (!checkedResponse) {
            return;
        }

        const result = await checkedResponse.json();

        if (!checkedResponse.ok || !result.success) {
            showMasterFileNotification(
                "error",
                "Update Failed",
                result.message ||
                    "Unable to update employee information."
            );
            return;
        }

        // Close the Edit Employee modal.
        editEmployeeDialog.close();

        // Reload Teaching, Non-Teaching, and Accounts records.
        await loadEmployeeRecords();

        // Display success notification.
        showMasterFileNotification(
            "success",
            "Employee Updated",
            result.message ||
                "Employee information updated successfully."
        );

    } catch (error) {
        console.error("Update Employee Error:", error);

        if (
            error instanceof TypeError &&
            window.PERSYSApiErrors?.handleNetworkError
        ) {
            window.PERSYSApiErrors.handleNetworkError(error);
        } else {
            showMasterFileNotification(
                "error",
                "Update Error",
                "An unexpected error occurred while updating the employee."
            );
        }

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
    }
});


// ====================================================
// CREATE ACCOUNT — PASSWORD VISIBILITY
// ====================================================

const toggleCreatePassword =
    document.getElementById("toggleCreatePassword");

const createAccountPassword =
    document.getElementById("password");

if (toggleCreatePassword && createAccountPassword) {

    toggleCreatePassword.addEventListener("click", function () {

        const isCurrentlyHidden =
            createAccountPassword.type === "password";

        createAccountPassword.type =
            isCurrentlyHidden ? "text" : "password";

        toggleCreatePassword.setAttribute(
            "aria-pressed",
            String(isCurrentlyHidden)
        );

        toggleCreatePassword.setAttribute(
            "aria-label",
            isCurrentlyHidden ? "Hide password" : "Show password"
        );

    });

}
