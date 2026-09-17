/**
 * ============================================================
 * ASSETSPRING BACKEND — Google Apps Script Web App
 * ============================================================
 *
 * IMPORTANT CONTEXT FOR WHOEVER DEPLOYS THIS FILE:
 * The uploaded project only contained the frontend (index.html + js/*.js).
 * No existing Code.gs / Apps Script backend was included, so this file is
 * a complete, newly-authored backend built to match exactly what the
 * frontend in js/api.js already expects (the same action names, the same
 * request/response shapes). If you already have a live Apps Script backend
 * for this app, treat this as a reference implementation: port the
 * WALLET SETTINGS, SAVINGS — FUND FROM BALANCE, and TESTIMONIALS sections
 * (which implement the specific requirements below) into your existing
 * project rather than replacing it outright, so any custom logic you
 * already have for deposits/withdrawals/investments/etc. is preserved.
 *
 * Implements, in full:
 *   1. Deposit wallet address served dynamically from a "WalletSettings"
 *      sheet (never hard-coded, no secrets sent to the frontend).
 *   2. Funding a savings goal from the user's available balance, validated
 *      and applied atomically server-side (LockService + one write pass).
 *   3-6. Testimonials: pending/approved/rejected workflow, super_admin-only
 *      management enforced server-side (not just hidden in the UI), and
 *      public endpoint that only ever returns approved testimonials.
 *   7-8. Sheet schema and balance-integrity rules described below.
 *
 * Every other action referenced by js/api.js (auth, deposits, withdrawals,
 * investments, transactions, referrals, notifications, newsletter, admin
 * users) is also implemented so the app works end-to-end out of the box.
 *
 * DEPLOYMENT
 *   1. Create/open the Apps Script project bound to (or standalone, with
 *      SPREADSHEET_ID set below) your Google Sheet.
 *   2. Paste this file in as Code.gs.
 *   3. Deploy > New deployment > Web app.
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   4. Copy the /exec URL into js/api.js -> API.BASE_URL.
 *   5. Run `setupSheets()` once from the Apps Script editor (or call the
 *      "setup" action) to create every sheet + header row + a default
 *      wallet setting + a default super_admin account (see SETUP below).
 */

// ============================================================
// CONFIGURATION
// ============================================================

// Leave blank ('') to use the spreadsheet this script is bound to.
// Set to a specific Spreadsheet ID to run as a standalone script instead.
const SPREADSHEET_ID = '';

const SHEETS = {
  USERS: 'Users',
  SESSIONS: 'Sessions',
  WALLET_SETTINGS: 'WalletSettings',
  DEPOSITS: 'Deposits',
  WITHDRAWALS: 'Withdrawals',
  INVESTMENT_PLANS: 'InvestmentPlans',
  INVESTMENTS: 'Investments',
  SAVINGS_GOALS: 'SavingsGoals',
  SAVINGS_TRANSACTIONS: 'SavingsTransactions',
  TRANSACTIONS: 'Transactions',
  TESTIMONIALS: 'Testimonials',
  NOTIFICATIONS: 'Notifications',
  NEWSLETTER: 'Newsletter',
  PASSWORD_RESETS: 'PasswordResets'
};

// Column headers for each sheet — the single source of truth for schema.
// "Use existing equivalent column names if they already exist" (req. #7):
// if you're merging this into a real project, rename these arrays to match
// your existing columns rather than duplicating equivalent fields.
const SCHEMA = {
  Users: ['id', 'fullName', 'username', 'email', 'phone', 'passwordHash', 'passwordSalt',
    'role', 'status', 'balance', 'referralCode', 'referredBy', 'createdAt'],
  Sessions: ['token', 'userId', 'createdAt', 'expiresAt'],
  WalletSettings: ['id', 'walletAddress', 'network', 'currency', 'status', 'updatedAt'],
  Deposits: ['id', 'userId', 'amount', 'cryptocurrency', 'network', 'walletAddress',
    'transactionHash', 'proofOfPayment', 'notes', 'status', 'submittedAt',
    'reviewedAt', 'reviewedBy', 'rejectionReason'],
  Withdrawals: ['id', 'userId', 'amount', 'withdrawalMethod', 'network', 'walletAddress',
    'notes', 'status', 'submittedAt', 'reviewedAt', 'reviewedBy', 'rejectionReason'],
  InvestmentPlans: ['id', 'name', 'expectedReturn', 'minAmount', 'maxAmount', 'duration', 'description'],
  Investments: ['id', 'userId', 'planId', 'amount', 'expectedReturn', 'status', 'startDate'],
  SavingsGoals: ['id', 'userId', 'name', 'targetAmount', 'currentAmount', 'targetDate', 'createdAt'],
  // Fields exactly as specified in requirement #2 ("Record each successful
  // transfer with information such as...").
  SavingsTransactions: ['id', 'userId', 'savingsGoalId', 'amount', 'transactionType',
    'previousBalance', 'newBalance', 'previousGoalBalance', 'newGoalBalance',
    'status', 'createdAt'],
  Transactions: ['id', 'userId', 'type', 'amount', 'description', 'status', 'createdAt', 'referenceId'],
  // Fields as specified in requirement #7.
  Testimonials: ['id', 'userId', 'userName', 'testimonial', 'status', 'createdAt', 'approvedAt', 'approvedBy'],
  Notifications: ['id', 'userId', 'title', 'message', 'read', 'createdAt'],
  Newsletter: ['id', 'title', 'content', 'publishedAt', 'publishedBy'],
  PasswordResets: ['token', 'userId', 'createdAt', 'expiresAt', 'used']
};

const ROLES = { REGULAR_USER: 'REGULAR_USER', ADMIN: 'ADMIN', SUPER_ADMIN: 'SUPER_ADMIN' };
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// ============================================================
// ENTRY POINT
// ============================================================

function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, error: 'BAD_REQUEST', message: 'Invalid JSON body.' });
  }

  const action = payload.action;
  const handler = ACTIONS[action];

  if (!handler) {
    return jsonResponse({ success: false, error: 'UNKNOWN_ACTION', message: 'Unknown action: ' + action });
  }

  // A single script-wide lock keeps every write serialized. For this app's
  // traffic level this is simpler and safer than fine-grained locking, and
  // it's what makes the balance <-> savings-goal transfer in requirement #2
  // truly atomic (see fundSavingsGoal below).
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return jsonResponse({ success: false, error: 'BUSY', message: 'Server is busy, please try again.' });
  }

  try {
    return jsonResponse(handler(payload));
  } catch (err) {
    console.error(err);
    return jsonResponse({ success: false, error: 'SERVER_ERROR', message: err.message || 'Unexpected server error.' });
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ACTION ROUTING TABLE
// ============================================================

const ACTIONS = {
  ping: () => ({ success: true, message: 'pong', data: { time: new Date().toISOString() } }),

  // Auth
  register: handleRegister,
  login: handleLogin,
  logout: handleLogout,
  getProfile: handleGetProfile,
  updateProfile: handleUpdateProfile,
  changePassword: handleChangePassword,

  // Password reset
  requestPasswordReset: handleRequestPasswordReset,
  validateResetToken: handleValidateResetToken,
  resetPassword: handleResetPassword,

  // Dashboard
  getDashboard: handleGetDashboard,

  // Wallet settings (requirement #1)
  getWalletSettings: handleGetWalletSettings,

  // Deposits (requirement #1)
  submitDeposit: handleSubmitDeposit,
  getDeposits: handleGetDeposits,
  getAllDeposits: handleGetAllDeposits,
  approveDeposit: handleApproveDeposit,
  rejectDeposit: handleRejectDeposit,

  // Withdrawals
  submitWithdrawal: handleSubmitWithdrawal,
  getWithdrawals: handleGetWithdrawals,
  getAllWithdrawals: handleGetAllWithdrawals,
  approveWithdrawal: handleApproveWithdrawal,
  rejectWithdrawal: handleRejectWithdrawal,

  // Investments
  getInvestmentPlans: handleGetInvestmentPlans,
  createInvestment: handleCreateInvestment,
  getInvestments: handleGetInvestments,

  // Savings (requirement #2, #8)
  createSavingsGoal: handleCreateSavingsGoal,
  getSavingsGoals: handleGetSavingsGoals,
  fundSavingsGoal: handleFundSavingsGoal,

  // Transactions
  getTransactions: handleGetTransactions,
  getAllTransactions: handleGetAllTransactions,

  // Referrals
  getReferralData: handleGetReferralData,

  // Notifications
  getNotifications: handleGetNotifications,
  markNotificationRead: handleMarkNotificationRead,

  // Testimonials (requirements #4, #5, #6)
  getPublicTestimonials: handleGetPublicTestimonials,
  getTestimonials: handleGetTestimonials,
  createTestimonial: handleCreateTestimonial,
  updateTestimonial: handleUpdateTestimonial,
  deleteTestimonial: handleDeleteTestimonial,

  // Newsletter
  getNewsletter: handleGetNewsletter,
  publishNewsletter: handlePublishNewsletter,

  // Admin
  getAllUsers: handleGetAllUsers
};

// ============================================================
// SHEET HELPERS
// ============================================================

function getSpreadsheet() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(SCHEMA[name]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function headerIndexMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((h, i) => { map[h] = i; });
  return map;
}

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}

function getAllRows(sheetName) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const headers = SCHEMA[sheetName];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(row => rowToObject(headers, row));
}

function appendRow(sheetName, obj) {
  const sheet = getSheet(sheetName);
  const headers = SCHEMA[sheetName];
  const row = headers.map(h => (obj[h] !== undefined ? obj[h] : ''));
  sheet.appendRow(row);
  return obj;
}

// Finds the 1-indexed sheet row matching a value in idColumn (defaults to
// "id" — Sessions/PasswordResets key off "token" instead). Returns -1 if
// not found.
function findRowById(sheetName, id, idColumn) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const idCol = SCHEMA[sheetName].indexOf(idColumn || 'id') + 1;
  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function updateRowById(sheetName, id, updates, idColumn) {
  const sheet = getSheet(sheetName);
  const rowIndex = findRowById(sheetName, id, idColumn);
  if (rowIndex === -1) return false;
  const headers = SCHEMA[sheetName];
  Object.keys(updates).forEach(key => {
    const col = headers.indexOf(key);
    if (col !== -1) {
      sheet.getRange(rowIndex, col + 1).setValue(updates[key]);
    }
  });
  return true;
}

function deleteRowById(sheetName, id, idColumn) {
  const sheet = getSheet(sheetName);
  const rowIndex = findRowById(sheetName, id, idColumn);
  if (rowIndex === -1) return false;
  sheet.deleteRow(rowIndex);
  return true;
}

function generateId(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
}

function nowIso() {
  return new Date().toISOString();
}

// ============================================================
// AUTH HELPERS
// ============================================================

function hashPassword(password, salt) {
  const raw = Utilities.computeHmacSha256Signature(password, salt);
  return raw.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function findUserByUsername(username) {
  const users = getAllRows(SHEETS.USERS);
  return users.find(u => u.username === username || u.email === username) || null;
}

function findUserById(userId) {
  const users = getAllRows(SHEETS.USERS);
  return users.find(u => String(u.id) === String(userId)) || null;
}

// Resolves the requesting user from payload.sessionToken. Returns null if
// missing/expired/invalid — callers must check and return an auth error.
function getSessionUser(payload) {
  if (!payload.sessionToken) return null;
  const sessions = getAllRows(SHEETS.SESSIONS);
  const session = sessions.find(s => s.token === payload.sessionToken);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  return findUserById(session.userId);
}

function requireAuth(payload) {
  const user = getSessionUser(payload);
  if (!user) {
    throw new AuthError('Please sign in to continue.');
  }
  return user;
}

// Server-side role enforcement — this is the actual authorization boundary.
// The frontend's role-based hiding is only a UX convenience; every
// sensitive action re-checks the role here regardless of what the client
// sent, per requirement #4 ("Do not rely only on hiding the interface").
function requireRole(user, allowedRoles) {
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError('You do not have permission to perform this action.', 'FORBIDDEN');
  }
}

function AuthError(message, code) {
  this.message = message;
  this.code = code || 'UNAUTHORIZED';
  this.isAuthError = true;
}

// Wraps a handler body so any AuthError becomes a clean { success:false }
// response instead of a generic 500 — used by every action below.
function guarded(fn) {
  try {
    return fn();
  } catch (err) {
    if (err && err.isAuthError) {
      return { success: false, error: err.code, message: err.message };
    }
    throw err;
  }
}

// ============================================================
// AUTHENTICATION
// ============================================================

function handleRegister(payload) {
  return guarded(() => {
    const { fullName, username, email, phone, password, confirmPassword, referralCode } = payload;

    if (!fullName || !username || !email || !phone || !password) {
      return { success: false, message: 'All fields are required.' };
    }
    if (password !== confirmPassword) {
      return { success: false, message: 'Passwords do not match.' };
    }
    if (password.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters.' };
    }
    if (findUserByUsername(username) || findUserByUsername(email)) {
      return { success: false, message: 'Username or email already in use.' };
    }

    const salt = Utilities.getUuid();
    const userId = generateId('usr');
    const newUser = {
      id: userId,
      fullName, username, email, phone,
      passwordHash: hashPassword(password, salt),
      passwordSalt: salt,
      role: ROLES.REGULAR_USER,
      status: 'ACTIVE',
      balance: 0,
      referralCode: Utilities.getUuid().substring(0, 8).toUpperCase(),
      referredBy: referralCode || '',
      createdAt: nowIso()
    };
    appendRow(SHEETS.USERS, newUser);

    return { success: true, message: 'Account created successfully.' };
  });
}

function handleLogin(payload) {
  return guarded(() => {
    const { username, password } = payload;
    const user = findUserByUsername(username);

    if (!user || hashPassword(password, user.passwordSalt) !== user.passwordHash) {
      return { success: false, message: 'Invalid username or password.' };
    }
    if (user.status === 'SUSPENDED') {
      return { success: false, message: 'This account has been suspended.' };
    }

    const token = Utilities.getUuid();
    appendRow(SHEETS.SESSIONS, {
      token, userId: user.id, createdAt: nowIso(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
    });

    return {
      success: true,
      data: { sessionToken: token, userId: user.id, name: user.fullName, role: user.role }
    };
  });
}

function handleLogout(payload) {
  return guarded(() => {
    if (payload.sessionToken) {
      deleteRowById(SHEETS.SESSIONS, payload.sessionToken, 'token');
    }
    return { success: true };
  });
}

function handleGetProfile(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    return { success: true, data: sanitizeUser(user) };
  });
}

function handleUpdateProfile(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    const updates = {};
    if (payload.fullName) updates.fullName = payload.fullName;
    if (payload.phone) updates.phone = payload.phone;
    updateRowById(SHEETS.USERS, user.id, updates);
    return { success: true, message: 'Profile updated.' };
  });
}

function handleChangePassword(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    const { currentPassword, newPassword, confirmNewPassword } = payload;

    if (hashPassword(currentPassword, user.passwordSalt) !== user.passwordHash) {
      return { success: false, message: 'Current password is incorrect.' };
    }
    if (newPassword !== confirmNewPassword) {
      return { success: false, message: 'New passwords do not match.' };
    }
    if (newPassword.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters.' };
    }

    const salt = Utilities.getUuid();
    updateRowById(SHEETS.USERS, user.id, { passwordHash: hashPassword(newPassword, salt), passwordSalt: salt });
    return { success: true, message: 'Password changed successfully.' };
  });
}

function sanitizeUser(user) {
  const copy = Object.assign({}, user);
  delete copy.passwordHash;
  delete copy.passwordSalt;
  return copy;
}

// ============================================================
// PASSWORD RESET (simplified — wire up MailApp if email delivery is needed)
// ============================================================

function handleRequestPasswordReset(payload) {
  return guarded(() => {
    const user = findUserByUsername(payload.username || payload.email);
    // Always respond success to avoid leaking which accounts exist.
    if (!user) return { success: true, message: 'If that account exists, a reset link has been sent.' };

    const token = Utilities.getUuid();
    appendRow(SHEETS.PASSWORD_RESETS, {
      token, userId: user.id, createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), used: false
    });
    // MailApp.sendEmail(user.email, 'Reset your password', 'Token: ' + token);
    return { success: true, message: 'If that account exists, a reset link has been sent.' };
  });
}

function handleValidateResetToken(payload) {
  return guarded(() => {
    const resets = getAllRows(SHEETS.PASSWORD_RESETS);
    const reset = resets.find(r => r.token === payload.token);
    const valid = !!reset && !reset.used && new Date(reset.expiresAt).getTime() > Date.now();
    return { success: valid, message: valid ? 'Token valid.' : 'Invalid or expired token.' };
  });
}

function handleResetPassword(payload) {
  return guarded(() => {
    const resets = getAllRows(SHEETS.PASSWORD_RESETS);
    const reset = resets.find(r => r.token === payload.token);
    if (!reset || reset.used || new Date(reset.expiresAt).getTime() < Date.now()) {
      return { success: false, message: 'Invalid or expired token.' };
    }
    if (!payload.newPassword || payload.newPassword.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters.' };
    }
    const salt = Utilities.getUuid();
    updateRowById(SHEETS.USERS, reset.userId, { passwordHash: hashPassword(payload.newPassword, salt), passwordSalt: salt });
    updateRowById(SHEETS.PASSWORD_RESETS, reset.token, { used: true }, 'token');
    return { success: true, message: 'Password reset successfully.' };
  });
}

// ============================================================
// WALLET SETTINGS (requirement #1)
// ============================================================
// Public read of ONLY the active wallet's address/network/currency — no
// spreadsheet IDs, no credentials, nothing but what the deposit form needs
// to display. Anyone with the deployed Web App URL can call this (matching
// how the deposit page works before a user necessarily logs in to view it);
// tighten with requireAuth(payload) here if deposits should be gated
// behind sign-in first in your deployment.

function handleGetWalletSettings(payload) {
  return guarded(() => {
    const wallets = getAllRows(SHEETS.WALLET_SETTINGS);
    const active = wallets.find(w => String(w.status).toUpperCase() === 'ACTIVE');

    if (!active) {
      // Handled gracefully — the frontend shows "unavailable" and blocks
      // submission rather than falling back to a hard-coded address.
      return { success: false, error: 'NO_ACTIVE_WALLET', message: 'No active wallet address is configured.' };
    }

    return {
      success: true,
      data: {
        walletAddress: active.walletAddress,
        network: active.network,
        currency: active.currency
      }
    };
  });
}

// ============================================================
// DASHBOARD
// ============================================================

function handleGetDashboard(payload) {
  return guarded(() => {
    const user = requireAuth(payload);

    const deposits = getAllRows(SHEETS.DEPOSITS).filter(d => d.userId === user.id);
    const withdrawals = getAllRows(SHEETS.WITHDRAWALS).filter(w => w.userId === user.id);
    const investments = getAllRows(SHEETS.INVESTMENTS).filter(i => i.userId === user.id);
    const savingsGoals = getAllRows(SHEETS.SAVINGS_GOALS).filter(g => g.userId === user.id);
    const transactions = getAllRows(SHEETS.TRANSACTIONS)
      .filter(t => t.userId === user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalDeposits = sumBy(deposits.filter(d => d.status === 'APPROVED'), 'amount');
    const totalWithdrawals = sumBy(withdrawals.filter(w => w.status === 'APPROVED'), 'amount');
    const totalInvestmentAmount = sumBy(investments, 'amount');
    const totalSavingsCurrentAmount = sumBy(savingsGoals, 'currentAmount');

    const data = {
      user: { balance: Number(user.balance) || 0 },
      totalDeposits, totalWithdrawals, totalInvestmentAmount, totalSavingsCurrentAmount,
      activeInvestments: investments.filter(i => i.status === 'ACTIVE').length,
      recentTransactions: transactions.slice(0, 10)
    };

    if (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN) {
      const allUsers = getAllRows(SHEETS.USERS);
      const allDeposits = getAllRows(SHEETS.DEPOSITS);
      const allWithdrawals = getAllRows(SHEETS.WITHDRAWALS);
      data.adminStats = {
        totalUsers: allUsers.length,
        pendingDeposits: allDeposits.filter(d => d.status === 'PENDING').length,
        pendingWithdrawals: allWithdrawals.filter(w => w.status === 'PENDING').length
      };
    }

    return { success: true, data };
  });
}

function sumBy(arr, field) {
  return arr.reduce((sum, item) => sum + (Number(item[field]) || 0), 0);
}

// ============================================================
// DEPOSITS (requirement #1)
// ============================================================

function handleSubmitDeposit(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    const { amount, cryptocurrency, network, walletAddress, transactionHash, proofOfPayment, notes } = payload;

    if (!amount || amount <= 0 || !cryptocurrency || !network || !transactionHash) {
      return { success: false, message: 'Please fill in all required fields.' };
    }

    const deposit = {
      id: generateId('dep'), userId: user.id, amount, cryptocurrency, network,
      walletAddress: walletAddress || '', transactionHash, proofOfPayment: proofOfPayment || '',
      notes: notes || '', status: 'PENDING', submittedAt: nowIso(),
      reviewedAt: '', reviewedBy: '', rejectionReason: ''
    };
    appendRow(SHEETS.DEPOSITS, deposit);

    return { success: true, message: 'Deposit submitted for review.', data: deposit };
  });
}

function handleGetDeposits(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    const deposits = getAllRows(SHEETS.DEPOSITS).filter(d => d.userId === user.id);
    return { success: true, data: deposits };
  });
}

function handleGetAllDeposits(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    requireRole(user, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);
    return { success: true, data: getAllRows(SHEETS.DEPOSITS) };
  });
}

// Approving a deposit is the ONLY place a deposit's amount enters a user's
// available balance (requirement #2's premise, and validation test #10:
// "Pending/rejected deposits do not incorrectly increase available balance").
function handleApproveDeposit(payload) {
  return guarded(() => {
    const admin = requireAuth(payload);
    requireRole(admin, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    const deposits = getAllRows(SHEETS.DEPOSITS);
    const deposit = deposits.find(d => d.id === payload.depositId);
    if (!deposit) return { success: false, message: 'Deposit not found.' };
    if (deposit.status !== 'PENDING') return { success: false, message: 'Deposit already reviewed.' };

    const depositUser = findUserById(deposit.userId);
    const newBalance = (Number(depositUser.balance) || 0) + Number(deposit.amount);

    updateRowById(SHEETS.USERS, depositUser.id, { balance: newBalance });
    updateRowById(SHEETS.DEPOSITS, deposit.id, {
      status: 'APPROVED', reviewedAt: nowIso(), reviewedBy: admin.id
    });
    appendRow(SHEETS.TRANSACTIONS, {
      id: generateId('txn'), userId: depositUser.id, type: 'DEPOSIT', amount: deposit.amount,
      description: 'Deposit approved', status: 'COMPLETED', createdAt: nowIso(), referenceId: deposit.id
    });
    notifyUser(depositUser.id, 'Deposit approved',
      'Your deposit of ' + deposit.amount + ' has been approved and added to your balance.');

    return { success: true, message: 'Deposit approved.' };
  });
}

function handleRejectDeposit(payload) {
  return guarded(() => {
    const admin = requireAuth(payload);
    requireRole(admin, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    const deposit = getAllRows(SHEETS.DEPOSITS).find(d => d.id === payload.depositId);
    if (!deposit) return { success: false, message: 'Deposit not found.' };
    if (deposit.status !== 'PENDING') return { success: false, message: 'Deposit already reviewed.' };

    updateRowById(SHEETS.DEPOSITS, deposit.id, {
      status: 'REJECTED', reviewedAt: nowIso(), reviewedBy: admin.id,
      rejectionReason: payload.rejectionReason || ''
    });
    notifyUser(deposit.userId, 'Deposit rejected', payload.rejectionReason || 'Your deposit was rejected.');

    return { success: true, message: 'Deposit rejected.' };
  });
}

// ============================================================
// WITHDRAWALS
// ============================================================

function handleSubmitWithdrawal(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    const { amount, withdrawalMethod, network, walletAddress, notes } = payload;

    if (!amount || amount <= 0 || !withdrawalMethod || !network || !walletAddress) {
      return { success: false, message: 'Please fill in all required fields.' };
    }
    if (amount > (Number(user.balance) || 0)) {
      return { success: false, message: 'Amount exceeds your available balance.' };
    }

    // Funds are held (deducted) at request time and restored on rejection —
    // this mirrors the savings-transfer integrity rule in requirement #8 so
    // the same balance can't be withdrawn twice while a request is pending.
    updateRowById(SHEETS.USERS, user.id, { balance: Number(user.balance) - Number(amount) });

    const withdrawal = {
      id: generateId('wdl'), userId: user.id, amount, withdrawalMethod, network,
      walletAddress, notes: notes || '', status: 'PENDING', submittedAt: nowIso(),
      reviewedAt: '', reviewedBy: '', rejectionReason: ''
    };
    appendRow(SHEETS.WITHDRAWALS, withdrawal);

    return { success: true, message: 'Withdrawal request submitted.', data: withdrawal };
  });
}

function handleGetWithdrawals(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    return { success: true, data: getAllRows(SHEETS.WITHDRAWALS).filter(w => w.userId === user.id) };
  });
}

function handleGetAllWithdrawals(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    requireRole(user, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);
    return { success: true, data: getAllRows(SHEETS.WITHDRAWALS) };
  });
}

function handleApproveWithdrawal(payload) {
  return guarded(() => {
    const admin = requireAuth(payload);
    requireRole(admin, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    const withdrawal = getAllRows(SHEETS.WITHDRAWALS).find(w => w.id === payload.withdrawalId);
    if (!withdrawal) return { success: false, message: 'Withdrawal not found.' };
    if (withdrawal.status !== 'PENDING') return { success: false, message: 'Withdrawal already reviewed.' };

    updateRowById(SHEETS.WITHDRAWALS, withdrawal.id, { status: 'APPROVED', reviewedAt: nowIso(), reviewedBy: admin.id });
    appendRow(SHEETS.TRANSACTIONS, {
      id: generateId('txn'), userId: withdrawal.userId, type: 'WITHDRAWAL', amount: withdrawal.amount,
      description: 'Withdrawal approved', status: 'COMPLETED', createdAt: nowIso(), referenceId: withdrawal.id
    });
    notifyUser(withdrawal.userId, 'Withdrawal approved', 'Your withdrawal has been approved and sent.');

    return { success: true, message: 'Withdrawal approved.' };
  });
}

function handleRejectWithdrawal(payload) {
  return guarded(() => {
    const admin = requireAuth(payload);
    requireRole(admin, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    const withdrawal = getAllRows(SHEETS.WITHDRAWALS).find(w => w.id === payload.withdrawalId);
    if (!withdrawal) return { success: false, message: 'Withdrawal not found.' };
    if (withdrawal.status !== 'PENDING') return { success: false, message: 'Withdrawal already reviewed.' };

    // Restore the held funds since the withdrawal did not go through.
    const withdrawalUser = findUserById(withdrawal.userId);
    updateRowById(SHEETS.USERS, withdrawalUser.id, { balance: Number(withdrawalUser.balance) + Number(withdrawal.amount) });
    updateRowById(SHEETS.WITHDRAWALS, withdrawal.id, {
      status: 'REJECTED', reviewedAt: nowIso(), reviewedBy: admin.id, rejectionReason: payload.rejectionReason || ''
    });
    notifyUser(withdrawal.userId, 'Withdrawal rejected', payload.rejectionReason || 'Your withdrawal was rejected and funds were returned to your balance.');

    return { success: true, message: 'Withdrawal rejected.' };
  });
}

// ============================================================
// INVESTMENTS
// ============================================================

function handleGetInvestmentPlans() {
  return guarded(() => ({ success: true, data: getAllRows(SHEETS.INVESTMENT_PLANS) }));
}

function handleCreateInvestment(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    const { planId, amount } = payload;
    const plan = getAllRows(SHEETS.INVESTMENT_PLANS).find(p => p.id === planId);

    if (!plan) return { success: false, message: 'Investment plan not found.' };
    if (!amount || amount <= 0) return { success: false, message: 'Enter a valid amount.' };
    if (amount > (Number(user.balance) || 0)) return { success: false, message: 'Amount exceeds your available balance.' };
    if (plan.minAmount && amount < Number(plan.minAmount)) return { success: false, message: 'Amount is below the plan minimum.' };
    if (plan.maxAmount && amount > Number(plan.maxAmount)) return { success: false, message: 'Amount exceeds the plan maximum.' };

    updateRowById(SHEETS.USERS, user.id, { balance: Number(user.balance) - Number(amount) });
    const investment = {
      id: generateId('inv'), userId: user.id, planId, amount,
      expectedReturn: plan.expectedReturn, status: 'ACTIVE', startDate: nowIso()
    };
    appendRow(SHEETS.INVESTMENTS, investment);
    appendRow(SHEETS.TRANSACTIONS, {
      id: generateId('txn'), userId: user.id, type: 'INVESTMENT', amount,
      description: 'Investment in ' + plan.name, status: 'COMPLETED', createdAt: nowIso(), referenceId: investment.id
    });

    return { success: true, message: 'Investment created.', data: investment };
  });
}

function handleGetInvestments(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    return { success: true, data: getAllRows(SHEETS.INVESTMENTS).filter(i => i.userId === user.id) };
  });
}

// ============================================================
// SAVINGS (requirements #2 and #8)
// ============================================================

function handleCreateSavingsGoal(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    const { goalName, targetAmount, targetDate } = payload;

    if (!goalName || !targetAmount || targetAmount <= 0 || !targetDate) {
      return { success: false, message: 'Please fill in all fields.' };
    }

    const goal = {
      id: generateId('sav'), userId: user.id, name: goalName,
      targetAmount, currentAmount: 0, targetDate, createdAt: nowIso()
    };
    appendRow(SHEETS.SAVINGS_GOALS, goal);
    return { success: true, message: 'Savings goal created.', data: goal };
  });
}

function handleGetSavingsGoals(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    const goals = getAllRows(SHEETS.SAVINGS_GOALS).filter(g => g.userId === user.id);
    const withProgress = goals.map(g => {
      const target = Number(g.targetAmount) || 0;
      const current = Number(g.currentAmount) || 0;
      return Object.assign({}, g, {
        progress: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
        remaining: Math.max(0, target - current)
      });
    });
    return { success: true, data: withProgress };
  });
}

/**
 * Funds a savings goal from the user's available balance.
 * Implements requirement #2 exactly:
 *   - requestedAmount > 0
 *   - requestedAmount <= availableBalance
 *   - user owns the selected savings goal
 *   - deduct from balance + credit the goal as one logical transaction
 *   - record a full SavingsTransactions row
 *
 * Because doPost() takes a script-wide lock before any handler runs, the
 * read-check-write sequence below cannot race with a concurrent request
 * from the same or another session — this is what makes "prevent duplicate
 * transaction submissions" and "prevent manipulation through dev tools"
 * hold: the amounts checked and written here are re-read from the sheet,
 * never trusted from anything the client asserts about its own balance.
 */
function handleFundSavingsGoal(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    const goalId = payload.goalId;
    const amount = Number(payload.amount);

    if (!goalId) return { success: false, message: 'Please select a savings goal.' };
    if (!amount || isNaN(amount) || amount <= 0) {
      return { success: false, message: 'Amount must be greater than zero.' };
    }

    // Re-read the authoritative current balance — never trust a balance
    // value if one were ever sent by the client.
    const freshUser = findUserById(user.id);
    const availableBalance = Number(freshUser.balance) || 0;

    if (amount > availableBalance) {
      return { success: false, message: 'Amount exceeds your available balance.' };
    }

    const goal = getAllRows(SHEETS.SAVINGS_GOALS).find(g => g.id === goalId);
    if (!goal) {
      return { success: false, message: 'Savings goal not found.' };
    }
    if (goal.userId !== user.id) {
      // "Funding another user's savings goal" — explicitly rejected.
      return { success: false, error: 'FORBIDDEN', message: 'You do not own this savings goal.' };
    }

    const previousBalance = availableBalance;
    const newBalance = previousBalance - amount;
    const previousGoalBalance = Number(goal.currentAmount) || 0;
    const newGoalBalance = previousGoalBalance + amount;

    // One logical transaction: both writes happen here, under the same
    // script lock, before any other request can observe an in-between
    // state where the money has left the balance but not yet reached the
    // goal (or vice versa) — this is the "must not remain available in the
    // user's balance" / "prevent double counting" rule from requirement #8.
    updateRowById(SHEETS.USERS, user.id, { balance: newBalance });
    updateRowById(SHEETS.SAVINGS_GOALS, goal.id, { currentAmount: newGoalBalance });

    const savingsTxn = {
      id: generateId('stx'), userId: user.id, savingsGoalId: goal.id, amount,
      transactionType: 'GOAL_FUNDING', previousBalance, newBalance,
      previousGoalBalance, newGoalBalance, status: 'COMPLETED', createdAt: nowIso()
    };
    appendRow(SHEETS.SAVINGS_TRANSACTIONS, savingsTxn);

    // Also mirror it into the general Transactions ledger so it shows up
    // in the Transactions page/filter alongside deposits & withdrawals.
    appendRow(SHEETS.TRANSACTIONS, {
      id: generateId('txn'), userId: user.id, type: 'SAVINGS', amount,
      description: 'Transferred to savings goal "' + goal.name + '"',
      status: 'COMPLETED', createdAt: nowIso(), referenceId: savingsTxn.id
    });

    return {
      success: true,
      message: 'Savings goal funded successfully.',
      data: { savingsTransaction: savingsTxn, newBalance, newGoalBalance }
    };
  });
}

// ============================================================
// TRANSACTIONS
// ============================================================

function handleGetTransactions(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    let transactions = getAllRows(SHEETS.TRANSACTIONS).filter(t => t.userId === user.id);
    if (payload.type && payload.type !== 'ALL') {
      transactions = transactions.filter(t => t.type === payload.type);
    }
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { success: true, data: transactions };
  });
}

function handleGetAllTransactions(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    requireRole(user, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);
    return { success: true, data: getAllRows(SHEETS.TRANSACTIONS) };
  });
}

// ============================================================
// REFERRALS
// ============================================================

function handleGetReferralData(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    const referredUsers = getAllRows(SHEETS.USERS).filter(u => u.referredBy === user.referralCode);
    return {
      success: true,
      data: {
        referralCode: user.referralCode,
        totalReferrals: referredUsers.length,
        referredUsers: referredUsers.map(u => ({ fullName: u.fullName, createdAt: u.createdAt }))
      }
    };
  });
}

// ============================================================
// NOTIFICATIONS
// ============================================================

function notifyUser(userId, title, message) {
  appendRow(SHEETS.NOTIFICATIONS, {
    id: generateId('ntf'), userId, title, message, read: false, createdAt: nowIso()
  });
}

function handleGetNotifications(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    const notifications = getAllRows(SHEETS.NOTIFICATIONS)
      .filter(n => n.userId === user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { success: true, data: notifications };
  });
}

function handleMarkNotificationRead(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    const notification = getAllRows(SHEETS.NOTIFICATIONS).find(n => n.id === payload.notificationId);
    if (!notification || notification.userId !== user.id) {
      return { success: false, message: 'Notification not found.' };
    }
    updateRowById(SHEETS.NOTIFICATIONS, notification.id, { read: true });
    return { success: true };
  });
}

// ============================================================
// TESTIMONIALS (requirements #4, #5, #6)
// ============================================================

// PUBLIC — approved testimonials only, for the Welcome page and the
// standalone Testimonials page. Pending/rejected testimonials must never
// appear here (requirement #6).
function handleGetPublicTestimonials() {
  return guarded(() => {
    const approved = getAllRows(SHEETS.TESTIMONIALS)
      .filter(t => String(t.status).toLowerCase() === 'approved')
      .sort((a, b) => new Date(b.approvedAt || b.createdAt) - new Date(a.approvedAt || a.createdAt));
    return { success: true, data: approved };
  });
}

// ADMIN — every testimonial regardless of status. Enforced server-side:
// only super_admin may call this, matching requirement #4's example
// ("if user.role !== 'super_admin': deny testimonial-management request").
function handleGetTestimonials(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    requireRole(user, [ROLES.SUPER_ADMIN]);
    const testimonials = getAllRows(SHEETS.TESTIMONIALS)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { success: true, data: testimonials };
  });
}

// Any authenticated user may submit a testimonial about their own
// experience. It always starts as pending — an admin-authored testimonial
// (created from the super-admin management screen) may instead be created
// pre-approved, since the super admin creating it IS the review step; a
// regular user can never set their own status.
function handleCreateTestimonial(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    const message = (payload.testimonial || payload.message || '').trim();

    if (!message) {
      return { success: false, message: 'Please enter your testimonial.' };
    }

    const isSelfAuthoredBySuperAdmin = user.role === ROLES.SUPER_ADMIN && payload.status;
    const status = isSelfAuthoredBySuperAdmin ? String(payload.status).toLowerCase() : 'pending';

    const testimonial = {
      id: generateId('tst'),
      userId: user.id,
      userName: payload.userName || user.fullName,
      testimonial: message,
      status: status, // 'pending' | 'approved' | 'rejected'
      createdAt: nowIso(),
      approvedAt: status === 'approved' ? nowIso() : '',
      approvedBy: status === 'approved' ? user.id : ''
    };
    appendRow(SHEETS.TESTIMONIALS, testimonial);

    return {
      success: true,
      message: status === 'pending' ? 'Testimonial submitted for review.' : 'Testimonial saved.',
      data: testimonial
    };
  });
}

// SUPER_ADMIN only — approve, reject, or edit a testimonial. This is the
// step that flips status: pending -> approved (goes public) or
// pending -> rejected (stays hidden), per requirement #5.
function handleUpdateTestimonial(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    requireRole(user, [ROLES.SUPER_ADMIN]);

    const testimonial = getAllRows(SHEETS.TESTIMONIALS).find(t => t.id === payload.testimonialId);
    if (!testimonial) return { success: false, message: 'Testimonial not found.' };

    const updates = {};
    if (payload.userName !== undefined) updates.userName = payload.userName;
    if (payload.testimonial !== undefined) updates.testimonial = payload.testimonial;

    if (payload.status !== undefined) {
      const status = String(payload.status).toLowerCase();
      updates.status = status;
      if (status === 'approved') {
        updates.approvedAt = nowIso();
        updates.approvedBy = user.id;
      } else {
        updates.approvedAt = '';
        updates.approvedBy = '';
      }
    }

    updateRowById(SHEETS.TESTIMONIALS, testimonial.id, updates);

    if (payload.status === 'approved' || payload.status === 'rejected') {
      notifyUser(testimonial.userId, 'Testimonial ' + payload.status,
        payload.status === 'approved'
          ? 'Your testimonial is now live on the Testimonials page. Thank you!'
          : 'Your testimonial was not approved for public posting.');
    }

    return { success: true, message: 'Testimonial updated.' };
  });
}

// SUPER_ADMIN only.
function handleDeleteTestimonial(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    requireRole(user, [ROLES.SUPER_ADMIN]);

    const deleted = deleteRowById(SHEETS.TESTIMONIALS, payload.testimonialId);
    return deleted
      ? { success: true, message: 'Testimonial deleted.' }
      : { success: false, message: 'Testimonial not found.' };
  });
}

// ============================================================
// NEWSLETTER (super_admin — consistent with the existing frontend gating)
// ============================================================

function handleGetNewsletter() {
  return guarded(() => {
    const newsletters = getAllRows(SHEETS.NEWSLETTER)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    return { success: true, data: newsletters };
  });
}

function handlePublishNewsletter(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    requireRole(user, [ROLES.SUPER_ADMIN]);

    const { title, content } = payload;
    if (!title || !content) return { success: false, message: 'Title and content are required.' };

    const newsletter = { id: generateId('nws'), title, content, publishedAt: nowIso(), publishedBy: user.id };
    appendRow(SHEETS.NEWSLETTER, newsletter);
    return { success: true, message: 'Newsletter published.', data: newsletter };
  });
}

// ============================================================
// ADMIN — USERS
// ============================================================

function handleGetAllUsers(payload) {
  return guarded(() => {
    const user = requireAuth(payload);
    requireRole(user, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);
    return { success: true, data: getAllRows(SHEETS.USERS).map(sanitizeUser) };
  });
}

// ============================================================
// SETUP — run once from the Apps Script editor before first use
// ============================================================

function setupSheets() {
  Object.keys(SCHEMA).forEach(name => getSheet(name));

  // Seed a default active wallet so the deposit page has something to
  // display immediately. Update the address/network/currency for real use.
  const wallets = getAllRows(SHEETS.WALLET_SETTINGS);
  if (wallets.length === 0) {
    appendRow(SHEETS.WALLET_SETTINGS, {
      id: generateId('wal'),
      walletAddress: 'REPLACE_WITH_YOUR_REAL_WALLET_ADDRESS',
      network: 'BSC', currency: 'USDT', status: 'ACTIVE', updatedAt: nowIso()
    });
  }

  // Seed one super_admin account so testimonial/newsletter management is
  // reachable on a fresh deployment. CHANGE THIS PASSWORD IMMEDIATELY.
  const users = getAllRows(SHEETS.USERS);
  if (users.length === 0) {
    const salt = Utilities.getUuid();
    appendRow(SHEETS.USERS, {
      id: generateId('usr'),
      fullName: 'Super Admin', username: 'superadmin', email: 'admin@example.com',
      phone: '', passwordHash: hashPassword('ChangeMe123!', salt), passwordSalt: salt,
      role: ROLES.SUPER_ADMIN, status: 'ACTIVE', balance: 0,
      referralCode: 'ADMIN0001', referredBy: '', createdAt: nowIso()
    });
  }

  Logger.log('Setup complete.');
}
