// ============================================================
// AUTHENTICATION
// ============================================================

const Auth = {
    SESSION_KEY: 'assetspring_session',
    USER_KEY: 'assetspring_user',
    
    getSession() {
        return localStorage.getItem(this.SESSION_KEY);
    },
    
    getUser() {
        try {
            const data = localStorage.getItem(this.USER_KEY);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },
    
    setSession(token, userData) {
        localStorage.setItem(this.SESSION_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(userData));
    },
    
    clearSession() {
        localStorage.removeItem(this.SESSION_KEY);
        localStorage.removeItem(this.USER_KEY);
    },
    
    isAuthenticated() {
        return !!this.getSession();
    },
    
    getRole() {
        const user = this.getUser();
        return user ? user.role : null;
    },
    
    isAdmin() {
        const role = this.getRole();
        return role === 'ADMIN' || role === 'SUPER_ADMIN';
    },
    
    isSuperAdmin() {
        return this.getRole() === 'SUPER_ADMIN';
    }
};

// ============================================================
// AUTH HANDLERS
// ============================================================

async function handleSignIn(event) {
    event.preventDefault();
    
    const username = document.getElementById('signin-username').value.trim();
    const password = document.getElementById('signin-password').value;
    const btn = document.getElementById('signin-btn');
    
    if (!username || !password) {
        UI.showToast('Please fill in all fields', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    
    const result = await Api.login({ username, password });
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    
    if (result.success) {
        Auth.setSession(result.data.sessionToken, {
            id: result.data.userId,
            name: result.data.name,
            role: result.data.role
        });
        
        UI.showToast('Welcome back, ' + result.data.name + '!', 'success');
        
        // Redirect to dashboard
        loadDashboard();
    } else {
        UI.showToast(result.message || 'Invalid credentials', 'error');
    }
}

async function handleSignUp(event) {
    event.preventDefault();
    
    const fullName = document.getElementById('signup-fullname').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const phone = document.getElementById('signup-phone').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const referralCode = document.getElementById('signup-referral').value.trim();

    // Registration consent — three separate acknowledgments per the
    // AssetSpring User Consent & Electronic Agreement (accuracy/compliance,
    // Terms + Privacy, and risk acknowledgment). All three are required.
    const consentAccuracy = document.getElementById('signup-consent-accuracy').checked;
    const consentLegal = document.getElementById('signup-consent-legal').checked;
    const consentRisk = document.getElementById('signup-consent-risk').checked;
    const termsAgreed = consentAccuracy && consentLegal && consentRisk;
    
    const btn = document.getElementById('signup-btn');
    
    // Validation
    if (!fullName || !username || !email || !phone || !password || !confirmPassword) {
        UI.showToast('Please fill in all required fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        UI.showToast('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 8) {
        UI.showToast('Password must be at least 8 characters', 'error');
        return;
    }
    
    if (!termsAgreed) {
        UI.showToast('Please check all three agreement boxes to continue', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
    
    const result = await Api.register({
        fullName,
        username,
        email,
        phone,
        password,
        confirmPassword,
        referralCode,
        termsAgreed,
        consentAccuracy,
        consentLegal,
        consentRisk
    });
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
    
    if (result.success) {
        UI.showToast('Account created successfully! Please sign in.', 'success');
        document.getElementById('signup-form').reset();
        showPage('signin');
    } else {
        UI.showToast(result.message || 'Registration failed', 'error');
    }
}

function handleLogout() {
    UI.confirm('Logout', 'Are you sure you want to logout?', async () => {
        await Api.logout();
        Auth.clearSession();
        document.getElementById('dashboard-container').style.display = 'none';
        showPage('welcome');
        UI.showToast('Logged out successfully', 'info');
    });
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.parentElement.querySelector('.toggle-password i');
    
    if (input.type === 'password') {
        input.type = 'text';
        button.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        button.className = 'fas fa-eye';
    }
}

// ============================================================
// SESSION VALIDATION
// ============================================================

async function validateSession() {
    const session = Auth.getSession();
    if (!session) {
        return false;
    }
    
    // In production, validate with backend
    // For now, just check if user data exists
    const user = Auth.getUser();
    if (!user) {
        Auth.clearSession();
        return false;
    }
    
    return true;
}

// ============================================================
// ROLE-BASED ACCESS
// ============================================================

function checkRole(requiredRole) {
    const user = Auth.getUser();
    if (!user) return false;
    
    const roles = ['REGULAR_USER', 'ADMIN', 'SUPER_ADMIN'];
    const userLevel = roles.indexOf(user.role);
    const requiredLevel = roles.indexOf(requiredRole);
    
    return userLevel >= requiredLevel;
}