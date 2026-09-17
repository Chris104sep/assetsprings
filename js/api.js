// ============================================================
// ASSETSPRING - API COMMUNICATION LAYER
// ============================================================
// Handles all communication between the frontend and the
// Google Apps Script backend (Web App).

const API = {
    // ============================================================
    // CONFIGURATION
    // ============================================================
    // Replace with your actual Web App URL:
    // Example: 'https://script.google.com/macros/s/AKfyc.../exec'
    BASE_URL: 'https://script.google.com/macros/s/AKfycbxQAFcWYkJIAPA4oQEnc-idU8G75x3VG1nIBKeWaNtFeNv_nWv3KrFBxjBBYrxRiZ5cZA/exec',

    // Request timeout (milliseconds)
    TIMEOUT: 30000,

    // Enable verbose logging (set false in production)
    DEBUG: true,

    // ============================================================
    // CORE REQUEST METHOD
    // ============================================================
    async request(action, data = {}) {
        // --------------------------------------------------------
        // 1. Build the payload
        // --------------------------------------------------------
        const payload = { ...data, action };

        // Attach session token if authenticated
        const session = (typeof Auth !== 'undefined' && Auth.getSession)
            ? Auth.getSession()
            : localStorage.getItem('assetspring_session');

        if (session) {
            payload.sessionToken = session;
        }

        // --------------------------------------------------------
        // 2. Validate configuration
        // --------------------------------------------------------
        if (!this.BASE_URL || this.BASE_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL') {
            const errMsg = 'API URL not configured. Please set API.BASE_URL in js/api.js';
            console.error(errMsg);
            if (typeof UI !== 'undefined') UI.showToast(errMsg, 'error');
            return { success: false, error: 'NOT_CONFIGURED', message: errMsg };
        }

        if (!this.BASE_URL.endsWith('/exec')) {
            console.warn(
                '[API] BASE_URL does not end with "/exec". ' +
                'Apps Script Web App URLs must end with "/exec". ' +
                'Current value:', this.BASE_URL
            );
        }

        // --------------------------------------------------------
        // 3. Show loading indicator
        // --------------------------------------------------------
        if (typeof UI !== 'undefined' && UI.showLoading) {
            UI.showLoading();
        }

        // --------------------------------------------------------
        // 4. Perform the fetch with timeout
        // --------------------------------------------------------
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

        try {
            if (this.DEBUG) {
                console.log('[API] Request:', action, payload);
            }

            const response = await fetch(this.BASE_URL, {
                method: 'POST',
                // NOTE: 'application/json' triggers a CORS preflight.
                // Apps Script does not handle OPTIONS preflight.
                // Using 'text/plain' avoids preflight and still allows
                // the body to be parsed as JSON on the server.
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(payload),
                redirect: 'follow',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // ----------------------------------------------------
            // 5. Read raw response text (for debugging)
            // ----------------------------------------------------
            const rawText = await response.text();

            if (this.DEBUG) {
                console.log('[API] HTTP status:', response.status);
                console.log('[API] Raw response (first 500 chars):',
                    rawText.substring(0, 500));
            }

            // ----------------------------------------------------
            // 6. Check HTTP status
            // ----------------------------------------------------
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // ----------------------------------------------------
            // 7. Detect HTML response (common misconfiguration)
            // ----------------------------------------------------
            const trimmed = rawText.trim();

            if (trimmed.startsWith('<')) {
                // The backend returned HTML — usually a Google sign-in
                // page or deployment error page.
                console.error(
                    '[API] Received HTML instead of JSON.\n' +
                    'This usually means:\n' +
                    '  • The Web App URL is wrong (use /exec, not /dev)\n' +
                    '  • The Web App is not deployed with "Anyone" access\n' +
                    '  • The Apps Script has a syntax/runtime error\n' +
                    'First 300 chars of response:\n' + trimmed.substring(0, 300)
                );

                if (typeof UI !== 'undefined') {
                    UI.hideLoading();
                    UI.showToast(
                        'Server returned an invalid response. ' +
                        'Check the Apps Script deployment.',
                        'error'
                    );
                }

                return {
                    success: false,
                    error: 'INVALID_RESPONSE',
                    message: 'Backend returned HTML instead of JSON. Check deployment.'
                };
            }

            // ----------------------------------------------------
            // 8. Parse JSON safely
            // ----------------------------------------------------
            let result;
            try {
                result = JSON.parse(trimmed);
            } catch (parseErr) {
                console.error('[API] JSON parse failed:', parseErr);
                console.error('[API] Raw response:', trimmed.substring(0, 500));

                if (typeof UI !== 'undefined') {
                    UI.hideLoading();
                    UI.showToast('Invalid response from server.', 'error');
                }

                return {
                    success: false,
                    error: 'PARSE_ERROR',
                    message: 'Could not parse server response as JSON.'
                };
            }

            // ----------------------------------------------------
            // 9. Hide loader and return result
            // ----------------------------------------------------
            if (typeof UI !== 'undefined') UI.hideLoading();

            if (this.DEBUG) {
                console.log('[API] Response:', result);
            }

            return result;

        } catch (error) {
            clearTimeout(timeoutId);

            if (typeof UI !== 'undefined') UI.hideLoading();

            // ----------------------------------------------------
            // 10. Handle specific error types
            // ----------------------------------------------------
            if (error.name === 'AbortError') {
                console.error('[API] Request timed out after', this.TIMEOUT, 'ms');
                if (typeof UI !== 'undefined') {
                    UI.showToast('Request timed out. Please try again.', 'error');
                }
                return {
                    success: false,
                    error: 'TIMEOUT',
                    message: 'Request timed out.'
                };
            }

            if (error.message && error.message.includes('Failed to fetch')) {
                console.error('[API] Network error — possible causes:\n' +
                    '  • No internet connection\n' +
                    '  • CORS blocked (Web App not set to "Anyone")\n' +
                    '  • Wrong URL\n' +
                    'Error:', error);

                if (typeof UI !== 'undefined') {
                    UI.showToast(
                        'Network error. Check your connection and deployment.',
                        'error'
                    );
                }

                return {
                    success: false,
                    error: 'NETWORK_ERROR',
                    message: 'Network error. Please check your connection.'
                };
            }

            console.error('[API] Unexpected error:', error);

            if (typeof UI !== 'undefined') {
                UI.showToast('An unexpected error occurred.', 'error');
            }

            return {
                success: false,
                error: 'UNKNOWN_ERROR',
                message: error.message || 'Unknown error occurred.'
            };
        }
    },

    // ============================================================
    // HEALTH CHECK
    // ============================================================
    // Use this to verify the backend is reachable and returning JSON.
    // Call from the browser console:  await API.ping()
    // ============================================================
    async ping() {
        console.log('[API] Pinging backend:', this.BASE_URL);
        const result = await this.request('ping');
        console.log('[API] Ping result:', result);
        return result;
    }
};

// ============================================================
// API ACTION WRAPPERS
// ============================================================
// Each method below maps to a backend action in Code.gs.
// All wrappers return the standard response shape:
//   { success: bool, message: string, data: any, error: string|null }
// ============================================================

const Api = {
    // --------------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------------
    register: (data) => API.request('register', data),
    login: (data) => API.request('login', data),
    logout: () => API.request('logout'),
    getProfile: () => API.request('getProfile'),
    updateProfile: (data) => API.request('updateProfile', data),
    changePassword: (data) => API.request('changePassword', data),

    // --------------------------------------------------------
    // PASSWORD RESET
    // --------------------------------------------------------
    requestPasswordReset: (data) => API.request('requestPasswordReset', data),
    validateResetToken: (data) => API.request('validateResetToken', data),
    resetPassword: (data) => API.request('resetPassword', data),

    // --------------------------------------------------------
    // DASHBOARD
    // --------------------------------------------------------
    getDashboard: () => API.request('getDashboard'),

    // --------------------------------------------------------
    // WALLET SETTINGS
    // --------------------------------------------------------
    // Returns the currently active deposit wallet address. Never
    // hard-coded on the frontend — always read from the backend's
    // walletsettings Google Sheet.
    getWalletSettings: () => API.request('getWalletSettings'),

    // --------------------------------------------------------
    // DEPOSITS
    // --------------------------------------------------------
    submitDeposit: (data) => API.request('submitDeposit', data),
    getDeposits: () => API.request('getDeposits'),
    getAllDeposits: () => API.request('getAllDeposits'),
    approveDeposit: (data) => API.request('approveDeposit', data),
    rejectDeposit: (data) => API.request('rejectDeposit', data),

    // --------------------------------------------------------
    // WITHDRAWALS
    // --------------------------------------------------------
    submitWithdrawal: (data) => API.request('submitWithdrawal', data),
    getWithdrawals: () => API.request('getWithdrawals'),
    getAllWithdrawals: () => API.request('getAllWithdrawals'),
    approveWithdrawal: (data) => API.request('approveWithdrawal', data),
    rejectWithdrawal: (data) => API.request('rejectWithdrawal', data),

    // --------------------------------------------------------
    // INVESTMENTS
    // --------------------------------------------------------
    getInvestmentPlans: () => API.request('getInvestmentPlans'),
    createInvestment: (data) => API.request('createInvestment', data),
    getInvestments: () => API.request('getInvestments'),

    // --------------------------------------------------------
    // SAVINGS
    // --------------------------------------------------------
    createSavingsGoal: (data) => API.request('createSavingsGoal', data),
    getSavingsGoals: () => API.request('getSavingsGoals'),
    // Transfers part or all of the user's available balance into a
    // savings goal. Validated and processed atomically server-side.
    fundSavingsGoal: (data) => API.request('fundSavingsGoal', data),

    // --------------------------------------------------------
    // TRANSACTIONS
    // --------------------------------------------------------
    getTransactions: (data) => API.request('getTransactions', data),
    getAllTransactions: () => API.request('getAllTransactions'),

    // --------------------------------------------------------
    // REFERRALS
    // --------------------------------------------------------
    getReferralData: () => API.request('getReferralData'),

    // --------------------------------------------------------
    // NOTIFICATIONS
    // --------------------------------------------------------
    getNotifications: () => API.request('getNotifications'),
    markNotificationRead: (data) => API.request('markNotificationRead', data),

    // --------------------------------------------------------
    // TESTIMONIALS
    // --------------------------------------------------------
    // Public: approved testimonials only (welcome page / testimonials page).
    getPublicTestimonials: () => API.request('getPublicTestimonials'),
    // Admin/management: ALL testimonials regardless of status. The backend
    // restricts this action to users with role SUPER_ADMIN.
    getTestimonials: () => API.request('getTestimonials'),
    // Any authenticated user may submit a testimonial; it is created with
    // status = pending and is not shown publicly until a super admin
    // approves it.
    createTestimonial: (data) => API.request('createTestimonial', data),
    // Super-admin only: approve/reject/edit a testimonial.
    updateTestimonial: (data) => API.request('updateTestimonial', data),
    // Super-admin only.
    deleteTestimonial: (data) => API.request('deleteTestimonial', data),

    // --------------------------------------------------------
    // NEWSLETTER
    // --------------------------------------------------------
    getNewsletter: () => API.request('getNewsletter'),
    publishNewsletter: (data) => API.request('publishNewsletter', data),

    // --------------------------------------------------------
    // ADMIN — USERS
    // --------------------------------------------------------
    getAllUsers: () => API.request('getAllUsers'),

    // --------------------------------------------------------
    // HEALTH CHECK
    // --------------------------------------------------------
    ping: () => API.ping()
};

// ============================================================
// GLOBAL ERROR HOOK (optional)
// ============================================================
// Catches unhandled promise rejections from API calls and logs them.
// ============================================================
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message) {
        console.error('[API] Unhandled rejection:', event.reason);
    }
});
