// ============================================================
// PASSWORD RESET
// ============================================================

async function handleForgotPassword(event) {
    event.preventDefault();
    
    const email = document.getElementById('forgot-email').value.trim();
    const btn = document.getElementById('forgot-btn');
    
    if (!email) {
        UI.showToast('Please enter your email', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    
    const result = await Api.requestPasswordReset({ email });
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Instructions';
    
    if (result.success) {
        UI.showToast('If an account matches this email, reset instructions have been sent.', 'success');
        document.getElementById('forgot-password-form').reset();
    } else {
        UI.showToast(result.message || 'Failed to send reset instructions', 'error');
    }
}

async function handleResetPassword(event) {
    event.preventDefault();
    
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;
    const token = document.getElementById('reset-password-form').dataset.token;
    const btn = document.getElementById('reset-btn');
    
    if (!newPassword || !confirmPassword) {
        UI.showToast('Please enter and confirm your new password', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        UI.showToast('Passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 8) {
        UI.showToast('Password must be at least 8 characters', 'error');
        return;
    }
    
    if (!token) {
        UI.showToast('Invalid reset link. Please request a new one.', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
    
    const result = await Api.resetPassword({ token, newPassword });
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-key"></i> Reset Password';
    
    if (result.success) {
        UI.showToast('Password reset successfully! Please sign in.', 'success');
        document.getElementById('reset-password-form').reset();
        setTimeout(() => {
            showPage('signin');
        }, 1500);
    } else {
        UI.showToast(result.message || 'Failed to reset password', 'error');
    }
}