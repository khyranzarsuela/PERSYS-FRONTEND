<?php
require_once '../../session.php';
start_app_session();
require_user();

$pdo   = db();

// 1. prepare()
$localCreditsStatement = $pdo->prepare("
    SELECT COALESCE(
        SUM(
            CASE
                WHEN transaction_type = 'EARNED'
                    THEN credit_amount
                WHEN transaction_type = 'DEDUCTED'
                    THEN -credit_amount
                ELSE 0
            END
        ), 0
    ) AS total_local_credits
    FROM service_credit_transactions
    WHERE employee_id = ?
      AND credit_type_id = 1
");

// 2. Use the correct variable name ($localCreditsStatement) to execute
$localCreditsStatement->execute([
    $_SESSION['employee_id']
]);

// 3. Fetch the result
$result = $localCreditsStatement->fetch(PDO::FETCH_ASSOC);

$totalLocalCredits = (float) $result['total_local_credits'];



$nationalCreditsStatement = $pdo->prepare("
    SELECT COALESCE(
        SUM(
            CASE
                WHEN transaction_type = 'EARNED'
                    THEN credit_amount
                WHEN transaction_type = 'DEDUCTED'
                    THEN -credit_amount
                ELSE 0
            END
        ), 0
    ) AS total_national_credits
    FROM service_credit_transactions
    WHERE employee_id = ?
      AND credit_type_id = 2
");

$nationalCreditsStatement->execute([
    $_SESSION['employee_id']
]);

$result = $nationalCreditsStatement->fetch(PDO::FETCH_ASSOC);

$totalNationalCredits = (float) $result['total_national_credits'];



// All transactions for this employee
$stmtTx = $pdo->prepare(
    "SELECT sct.transaction_id, sct.activity_name, sct.activity_start_date, sct.activity_end_date,
            sct.credit_amount, sct.transaction_type, sct.created_at,
            sty.credit_type_name
     FROM service_credit_transactions sct
     INNER JOIN service_credit_types sty ON sty.credit_type_id = sct.credit_type_id
     WHERE sct.employee_id = ?
     ORDER BY sct.created_at DESC"
);
$stmtTx->execute([$_SESSION['employee_id']]);
$transactions = $stmtTx->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BCSHS-SAC | Service Credits</title>
  <link rel="stylesheet" href="../../styles/user.css" />
  <script src="https://code.jquery.com/jquery-3.7.1.min.js"
          integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo="
          crossorigin="anonymous"></script>
</head>
<body>
  <div class="sidebar-overlay" id="sidebarOverlay" aria-hidden="true"></div>
  <div class="app-shell">

    <!-- ── SIDEBAR: Service Credits active ───────────────────── -->
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
            <a href="userServiceCredits.php" class="nav-item active" aria-current="page">
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
        <span class="topbar-svg-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="5"/><path d="M7.5 14.5L5 21l7-2.5L19 21l-2.5-6.5"/></svg>
        </span>
        <h1 class="topbar-title">Service Credits</h1>
        <button class="hamburger" id="hamburger" type="button"
                aria-controls="sidebar" aria-expanded="false"
                aria-label="Toggle navigation menu">
          <span></span><span></span><span></span>
        </button>
      </header>

      <main class="page-content service-credits-content" id="mainContent">

        <h2 class="sc-page-heading">Your Service Credits</h2>

        <!-- Balance cards -->
        <div class="credit-balance-cards">
          <div class="credit-balance-card">
            <div class="credit-balance-card-title">Local Service Credits</div>
            <div class="credit-balance-number"><?= number_format($totalLocalCredits, 2) ?></div>
          </div>
          <div class="credit-balance-card">
            <div class="credit-balance-card-title">National Service Credits</div>
            <div class="credit-balance-number"><?= number_format($totalNationalCredits, 2) ?></div>
          </div>
        </div>

        <!-- Transaction history table -->
        <div class="sc-log-table">
          <div class="table-header-bar">
            <h3>Claim Log and Usage History</h3>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Request Date</th>
                <th>Credit Type</th>
                <th>Service Activity</th>
                <th>Status</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              <?php if (empty($transactions)): ?>
              <tr class="empty-row"><td colspan="5">No service credit transactions found.</td></tr>
              <?php else: ?>
              <?php foreach ($transactions as $tx): ?>
              <tr>
                <td><?= date('m/d/Y', strtotime($tx['created_at'])) ?></td>
                <td><?= htmlspecialchars($tx['credit_type_name']) ?></td>
                <td><?= htmlspecialchars($tx['activity_name']) ?></td>
                <td>
                  <?php
                  $bc2 = $tx['transaction_type'] === 'EARNED'
                      ? 'status-badge--approved'
                      : 'status-badge--rejected';
                  ?>
                  <span class="status-badge <?= $bc2 ?>"><?= htmlspecialchars($tx['transaction_type']) ?></span>
                </td>
                <td><?= number_format((float)$tx['credit_amount'], 2) ?></td>
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
