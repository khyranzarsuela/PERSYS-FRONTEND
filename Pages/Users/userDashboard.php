<?php
require_once '../../session.php';
start_app_session();
require_user();

$pdo   = db();
$empId = (int) $_SESSION['employee_id'];

// --- Leave request counts ---
$stmtPending = $pdo->prepare(
    "SELECT COUNT(*) FROM leave_requests WHERE employee_id = ? AND status = 'Pending'"
);
$stmtPending->execute([$empId]);
$pendingCount = (int) $stmtPending->fetchColumn();

$stmtApproved = $pdo->prepare(
    "SELECT COUNT(*) FROM leave_requests WHERE employee_id = ? AND status = 'Approved'"
);
$stmtApproved->execute([$empId]);
$approvedCount = (int) $stmtApproved->fetchColumn();

$stmtRejected = $pdo->prepare(
    "SELECT COUNT(*) FROM leave_requests WHERE employee_id = ? AND status = 'Rejected'"
);
$stmtRejected->execute([$empId]);
$rejectedCount = (int) $stmtRejected->fetchColumn();

// --- Service credit balances ---
function getBalance(PDO $pdo, int $empId, int $typeId): float {
    $s = $pdo->prepare(
        "SELECT
            COALESCE(SUM(CASE WHEN transaction_type='EARNED'   THEN credit_amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN transaction_type='DEDUCTED' THEN credit_amount ELSE 0 END), 0)
         FROM service_credit_transactions
         WHERE employee_id = ? AND credit_type_id = ?"
    );
    $s->execute([$empId, $typeId]);
    return (float) $s->fetchColumn();
}
$localBalance    = getBalance($pdo, $empId, 1);
$nationalBalance = getBalance($pdo, $empId, 2);

// --- 5 most recent leave requests ---
$stmtRecent = $pdo->prepare(
    "SELECT lr.leave_request_id, lr.request_number, lr.date_filed,
            lr.total_leave_days, lr.status, lt.leave_type_name
     FROM leave_requests lr
     INNER JOIN leave_types lt ON lt.leave_type_id = lr.leave_type_id
     WHERE lr.employee_id = ?
     ORDER BY lr.created_at DESC
     LIMIT 5"
);
$stmtRecent->execute([$empId]);
$recentLeaves = $stmtRecent->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BCSHS-SAC | My Dashboard</title>
  <link rel="stylesheet" href="../../styles/user.css" />
  <script src="https://code.jquery.com/jquery-3.7.1.min.js"
          integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo="
          crossorigin="anonymous"></script>
</head>
<body>
  <div class="sidebar-overlay" id="sidebarOverlay" aria-hidden="true"></div>
  <div class="app-shell">

    <!-- ── SIDEBAR: My Dashboard active ─────────────────────── -->
    <aside class="sidebar" id="sidebar" aria-label="User navigation">
      <img class="sidebar-avatar" src="https://placehold.co/72x72/6B0FBA/FFFFFF?text=U" alt="User profile photo" />
      <p class="sidebar-name"><?php echo htmlspecialchars($_SESSION['username']); ?></p>
      <p class="sidebar-role"><?php echo htmlspecialchars($_SESSION['role_name']); ?></p>
      <div class="sidebar-divider" role="separator"></div>
      <nav aria-label="Main menu">
        <ul class="sidebar-nav">
          <li>
            <a href="userDashboard.php" class="nav-item active" aria-current="page">
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
            <a href="userProfile.php" class="nav-item">
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

    <div class="main-wrapper">
      <!-- TOPBAR -->
      <header class="topbar" role="banner">
        <span class="topbar-icon" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </span>
        <h1 class="topbar-title">My Dashboard</h1>
        <button class="hamburger" id="hamburger" type="button"
                aria-controls="sidebar" aria-expanded="false"
                aria-label="Toggle navigation menu">
          <span></span><span></span><span></span>
        </button>
      </header>

      <main class="page-content dashboard-content" id="mainContent">

        <!-- SECTION A: Stat cards row -->
        <div class="stat-cards-row">

          <!-- Card 1: Pending -->
          <div class="stat-card-h">
            <div class="stat-card-header">
              <div class="stat-icon-circle stat-icon--yellow">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <span class="stat-label-h">Pending Leave Request</span>
            </div>
            <div class="stat-number-h"><?= $pendingCount ?></div>
          </div>

          <!-- Card 2: Approved -->
          <div class="stat-card-h">
            <div class="stat-card-header">
              <div class="stat-icon-circle stat-icon--green">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span class="stat-label-h">Approved Leave Request</span>
            </div>
            <div class="stat-number-h"><?= $approvedCount ?></div>
          </div>

          <!-- Card 3: Rejected -->
          <div class="stat-card-h">
            <div class="stat-card-header">
              <div class="stat-icon-circle stat-icon--red">
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </div>
              <span class="stat-label-h">Rejected Leave Request</span>
            </div>
            <div class="stat-number-h"><?= $rejectedCount ?></div>
          </div>

        </div>

        <!-- SECTION B: SC Balance + Quick Action -->
        <div class="dashboard-bottom-row">

          <div class="sc-balance-card">
            <div class="sc-balance-heading">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="5"/><path d="M7.5 14.5L5 21l7-2.5L19 21l-2.5-6.5"/></svg>
              Service Credit Balance
            </div>
            <div class="sc-balance-rows">
              <div class="sc-balance-row">
                <span class="sc-balance-label">Local</span>
                <span class="sc-balance-value"><?= number_format($localBalance, 2) ?></span>
              </div>
              <div class="sc-balance-row">
                <span class="sc-balance-label">National</span>
                <span class="sc-balance-value"><?= number_format($nationalBalance, 2) ?></span>
              </div>
            </div>
            <a href="userServiceCredits.php" class="btn-yellow" style="align-self:flex-start;">
              View Service Credits
            </a>
          </div>

          <div class="quick-action-card">
            <div class="quick-action-title">Quick Action</div>
            <a href="userRequest.php" class="quick-action-link">
              <svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>
              Request a Leave
            </a>
            <a href="userRequest.php" class="btn-yellow" style="align-self:flex-start;">
              Request a Leave
            </a>
          </div>

        </div>

        <!-- SECTION C: Recent leave requests table -->
        <div class="recent-leave-table">
          <div class="table-header-bar">
            <h3>My Recent Leave Request</h3>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Leave Request #</th>
                <th>Date Filed</th>
                <th>Total Days</th>
                <th>Status</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              <?php if (empty($recentLeaves)): ?>
              <tr class="empty-row"><td colspan="5">No leave requests found.</td></tr>
              <?php else: ?>
              <?php foreach ($recentLeaves as $lr): ?>
              <tr>
                <td><?= htmlspecialchars($lr['request_number']) ?></td>
                <td><?= date('m/d/Y', strtotime($lr['date_filed'])) ?></td>
                <td><?= htmlspecialchars($lr['total_leave_days']) ?></td>
                <td>
                  <?php
                  $badgeClass = match($lr['status']) {
                      'Approved' => 'status-badge--approved',
                      'Rejected' => 'status-badge--rejected',
                      default    => 'status-badge--pending',
                  };
                  ?>
                  <span class="status-badge <?= $badgeClass ?>">
                    <?= htmlspecialchars($lr['status']) ?>
                  </span>
                </td>
                <td><a href="userRequest.php">View</a></td>
              </tr>
              <?php endforeach; ?>
              <?php endif; ?>
            </tbody>
          </table>
        </div>

      </main>
    </div>
  </div>

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
