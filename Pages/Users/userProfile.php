<?php

require_once '../../session.php';

start_app_session();
require_user();

$pdo = db();

// Count active teaching personnel
$stmt = db()->prepare("
    SELECT
        e.employee_id,
        e.employee_number,
        e.last_name,
        e.first_name,
        e.middle_name,
        e.plantilla_item_number,
        e.position,
        e.salary_grade,
        e.step_increment,
        e.date_original_appointment,
        e.date_last_promotion,
        e.deped_email,

        a.username,
        r.role_name

    FROM employees e

    INNER JOIN accounts a
        ON a.employee_id = e.employee_id

    INNER JOIN roles r
        ON r.role_id = a.role_id

    WHERE e.employee_id = ?
      AND a.is_active = 1
");

$stmt->execute([$_SESSION['employee_id']]);

$profile = $stmt->fetch();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BCSHS-SAC | Profile</title>

  <!--
    Paths relative to Pages/Admin/ — go up two levels to reach root.
    admin.css  : shared shell (sidebar, topbar, app-shell)
    admin-profile.css : profile-specific card + grid styles
  -->
  <link rel="stylesheet" href="../../styles/user.css" />
  <link rel="stylesheet" href="../../styles/user-profile.css" />
  <script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>
</head>
<body>

  <!-- ======================================================
       Admin Profile Page
       Shell identical to adminDashboard.html.
       Page content swapped to profile-content layout.
  ====================================================== -->

  <!-- Mobile sidebar backdrop -->
  <div class="sidebar-overlay" id="sidebarOverlay" aria-hidden="true"></div>

  <div class="app-shell">

    <!-- ── SIDEBAR ──────────────────────────────────────── -->
    <aside class="sidebar" id="sidebar" aria-label="User navigation">
      <img class="sidebar-avatar" src="https://placehold.co/72x72/6B0FBA/FFFFFF?text=U" alt="User profile photo" />
      <p class="sidebar-name"><?php echo htmlspecialchars($_SESSION['username']); ?></p>
      <p class="sidebar-role"><?php echo htmlspecialchars($_SESSION['role_name']); ?></p>
      <div class="sidebar-divider" role="separator"></div>
      <nav aria-label="Main menu">
        <ul class="sidebar-nav">
          <li>
            <a href="userDashboard.php" class="nav-item">
              <span class="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </span>
              My Dashboard
            </a>
          </li>
          <li>
            <a href="userProfile.php" class="nav-item active" aria-current="page">
              <span class="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              </span>
              Profile
            </a>
          </li>
          <li>
            <a href="userServiceCredits.php" class="nav-item">
              <span class="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="9" r="5"/>
                  <path d="M7.5 14.5L5 21l7-2.5L19 21l-2.5-6.5"/>
                </svg>
              </span>
              Service Credits
            </a>
          </li>
          <li>
            <a href="userRequest.php" class="nav-item">
              <span class="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="4" y="2" width="16" height="20" rx="2"/>
                  <line x1="8" y1="7" x2="16" y2="7"/>
                  <line x1="8" y1="11" x2="16" y2="11"/>
                  <line x1="8" y1="15" x2="12" y2="15"/>
                </svg>
              </span>
              Request
            </a>
          </li>
          <li>
            <a href="userSettings.php" class="nav-item">
              <span class="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
                </svg>
              </span>
              Settings
            </a>
          </li>
        </ul>
      </nav>
    </aside>
    <!-- ── END SIDEBAR ───────────────────────────────────── -->

    <!-- ── MAIN WRAPPER ─────────────────────────────────── -->
    <div class="main-wrapper">

      <!-- Topbar — person icon variant for Profile page -->
      <header class="topbar" role="banner">
        <span class="topbar-person-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </span>
        <h1 class="topbar-title">Profile</h1>

        <!-- Mobile hamburger -->
        <button
          class="hamburger"
          id="hamburger"
          type="button"
          aria-controls="sidebar"
          aria-expanded="false"
          aria-label="Toggle navigation menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </header>

      <!-- ── PAGE CONTENT ─────────────────────────────── -->
      <main class="page-content profile-content" id="mainContent">

        <!-- ══════════════════════════════════════════════
             CARD 1 — Personal Information
        ══════════════════════════════════════════════ -->
        <section class="profile-card" aria-labelledby="personalInfoTitle">

          <h2 class="profile-card-title" id="personalInfoTitle">
            Personal Information
          </h2>

          <!-- 3-column grid: Last Name | First Name | Middle Name -->
          <dl class="info-grid cols-3">

            <div class="info-field">
              <dt class="field-key">Last Name</dt>
              <dd class="field-val"><?= htmlspecialchars($profile['last_name']) ?></dd>
            </div>

            <div class="info-field">
              <dt class="field-key">First Name</dt>
              <dd class="field-val"><?= htmlspecialchars($profile['first_name']) ?></dd>
            </div>

            <div class="info-field">
              <dt class="field-key">Middle Name</dt>
              <dd class="field-val"><?= htmlspecialchars($profile['middle_name']) ?></dd>
            </div>

          </dl>
        </section>

        <!-- ══════════════════════════════════════════════
             CARD 2 — Employee Information
        ══════════════════════════════════════════════ -->
        <section class="profile-card" aria-labelledby="employeeInfoTitle">
          <h2 class="profile-card-title" id="employeeInfoTitle">
            Employee Information
          </h2>

          <!-- 2-column grid for paired fields -->
          <dl class="info-grid cols-2">

            <div class="info-field">
              <dt class="field-key">Plantilla Item No.</dt>
              <dd class="field-val"><?= htmlspecialchars($profile['plantilla_item_number']) ?></dd>
            </div>

            <div class="info-field">
              <dt class="field-key">Position</dt>
              <dd class="field-val"><?= htmlspecialchars($profile['position']) ?></dd>
            </div>

            <div class="info-field">
              <dt class="field-key">Salary Grade</dt>
              <dd class="field-val"><?= htmlspecialchars($profile['salary_grade']) ?></dd>
            </div>

            <div class="info-field">
              <dt class="field-key">Step Increment</dt>
              <dd class="field-val"><?= htmlspecialchars($profile['step_increment']) ?></dd>
            </div>

            <div class="info-field">
              <dt class="field-key">Date of Original Appointment</dt>
              <dd class="field-val"> <?= date(
                    'm/d/y',
                    strtotime($profile['date_original_appointment'])
                ) ?></dd>
            </div>

            <div class="info-field">
              <dt class="field-key">Date of Last Promotion</dt>
              <dd class="field-val">  <?= !empty($profile['date_last_promotion']) 
        ? date('m/d/y', strtotime($profile['date_last_promotion'])) 
        : 'None' ?></dd>
            </div>

            <!-- Employee Number spans both columns -->
            <div class="info-field span-full">
              <dt class="field-key">Employee Number</dt>
              <dd class="field-val"><?= htmlspecialchars($profile['employee_number']) ?></dd>
            </div>

          </dl>
        </section>

        <!-- ══════════════════════════════════════════════
             CARD 3 — Account Information
        ══════════════════════════════════════════════ -->
        <section class="profile-card" aria-labelledby="accountInfoTitle">
          <h2 class="profile-card-title" id="accountInfoTitle">
            Account Information
          </h2>

          <div class="account-grid">

            <!-- DepEd Email -->
            <div class="info-field">
              <span class="field-key">DepEd Email</span>
              <span class="field-val">
                <a href="#">
                 <?= htmlspecialchars($profile['deped_email']) ?>
                </a>
              </span>
            </div>

            <!-- Username -->
            <div class="info-field">
              <span class="field-key">Username</span>
              <span class="field-val"><?= htmlspecialchars($profile['username']) ?></span>
            </div>

            <!-- Password row — field left, Change Password button right -->
            <div class="password-row">

              <!-- Password field block -->
              <div class="password-field">
                <span class="field-key">Password</span>
                <div class="password-display">
                  <!--
                    data-password holds the real value for JS to reveal.
                    Default display (textContent) is set to dots by JS on load.
                  -->
                  <span
                    class="password-value field-val"
                    id="profilePasswordValue"
                    data-password=""
                  ></span>

                  <!-- Eye toggle button -->
                  <button
                    type="button"
                    class="btn-eye-toggle"
                    id="profilePasswordToggle"
                    aria-label="Show password"
                    aria-pressed="false"
                  >
                    <!-- Eye-off (default — password masked) -->
                    <svg class="eye-off" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20
                               C7 20 2.73 16.11 1 12
                               c.75-1.8 1.98-3.37 3.52-4.56
                               M9.9 4.24A9.12 9.12 0 0 1 12 4
                               c5 0 9.27 3.89 11 8
                               a10.15 10.15 0 0 1-1.67 2.67"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                      <path d="M10.73 10.73A3 3 0 0 0 14.83 14.83"/>
                    </svg>
                    <!-- Eye-on (visible when password is shown) -->
                    <svg class="eye-on" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M1 12C2.73 7.89 7 4 12 4s9.27 3.89 11 8
                               c-1.73 4.11-6 8-11 8S2.73 16.11 1 12Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Change Password button (yellow, right-aligned by flex parent) -->
              <button type="button" class="btn-change-password">
                <!-- Lock icon -->
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Change Password
              </button>

            </div>
            <!-- end .password-row -->

          </div>
          <!-- end .account-grid -->
        </section>

        <!-- ── Log Out button — bottom right ──────────── -->
        <div class="profile-footer">
          <button type="button" class="btn-logout">
            <!-- Log-out arrow icon -->
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Log Out
          </button>
        </div>

      </main>
      <!-- ── END PAGE CONTENT ──────────────────────────── -->

    </div>
    <!-- ── END MAIN WRAPPER ──────────────────────────────── -->

  </div>
  <!-- ── END APP SHELL ──────────────────────────────────── -->

  <!-- Logout Confirmation Modal -->
  <div class="modal-overlay" id="logoutModal" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="logoutModalTitle">
    <div class="modal-box">
      <div class="modal-header">
        <h2 id="logoutModalTitle">Log Out</h2>
      </div>
      <div class="modal-body">
        <p>Are you sure you want to log out?</p>
      </div>
      <div class="modal-footer">
        <button type="button" id="cancelLogoutBtn" class="btn-secondary">Cancel</button>
        <button type="button" id="confirmLogoutBtn" class="btn-yellow">Log Out</button>
      </div>
    </div>
  </div>

  <script src="../../scripts/user.js"></script>
  <script src="../../scripts/settings.js"></script>
</body>
</html>
