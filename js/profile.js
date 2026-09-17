// ============================================================
// PROFILE
// ============================================================

async function loadProfile() {
    UI.showLoading();
    
    try {
        const result = await Api.getProfile();
        if (!result.success) {
            UI.showToast(result.message || 'Failed to load profile', 'error');
            return;
        }
        
        renderProfile(result.data);
    } catch (error) {
        console.error('Profile error:', error);
        UI.showToast('Error loading profile', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderProfile(user) {
    const container = document.getElementById('profile-content');
    
    container.innerHTML = `
        <div class="profile-card">
            <h3><i class="fas fa-user"></i> Personal Information</h3>
            <div class="profile-field">
                <span class="label">Full Name</span>
                <span class="value">${user.fullName || 'N/A'}</span>
            </div>
            <div class="profile-field">
                <span class="label">Username</span>
                <span class="value">${user.username || 'N/A'}</span>
            </div>
            <div class="profile-field">
                <span class="label">Email</span>
                <span class="value">${user.email || 'N/A'}</span>
            </div>
            <div class="profile-field">
                <span class="label">Phone</span>
                <span class="value">${user.phone || 'N/A'}</span>
            </div>
            <div class="profile-field">
                <span class="label">Role</span>
                <span class="value">${getStatusBadge(user.role)}</span>
            </div>
            <div class="profile-field">
                <span class="label">Status</span>
                <span class="value">${getStatusBadge(user.status)}</span>
            </div>
            <div class="profile-field">
                <span class="label">Balance</span>
                <span class="value" style="font-weight: 700; color: var(--primary);">${formatCurrency(user.balance)}</span>
            </div>
            <div class="profile-field">
                <span class="label">Member Since</span>
                <span class="value">${formatDate(user.createdAt)}</span>
            </div>
            <div style="margin-top: 16px; display: flex; gap: 12px; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="showProfileEditModal()">
                    <i class="fas fa-edit"></i> Edit Profile
                </button>
                <button class="btn btn-secondary" onclick="showChangePasswordModal()">
                    <i class="fas fa-key"></i> Change Password
                </button>
            </div>
        </div>
        <div class="profile-card">
            <h3><i class="fas fa-comment-dots"></i> Share Your Story</h3>
            <p style="color: var(--text-light); margin-bottom: 12px;">
                Enjoying AssetSpring? Submit a testimonial — a member of our
                super admin team reviews every submission before it appears
                on the public Testimonials page.
            </p>
            <button class="btn btn-outline btn-block" onclick="showSubmitTestimonialModal()">
                <i class="fas fa-paper-plane"></i> Submit a Testimonial
            </button>
        </div>
        <div class="profile-card">
            <h3><i class="fas fa-gift"></i> Referral</h3>
            <div class="profile-field">
                <span class="label">Referral Code</span>
                <span class="value" style="font-family: monospace; font-weight: 700; color: var(--primary);">${user.referralCode || 'N/A'}</span>
            </div>
            <div style="margin-top: 12px;">
                <button class="btn btn-outline btn-block" onclick="copyToClipboard('${user.referralCode || ''}')">
                    <i class="fas fa-copy"></i> Copy Referral Code
                </button>
            </div>
        </div>
    `;
}

function showProfileEditModal() {
    // Create a simple inline edit
    const fullName = prompt('Enter your full name:', document.querySelector('.profile-field .value')?.textContent || '');
    if (fullName === null) return;
    
    const phone = prompt('Enter your phone number:', document.querySelectorAll('.profile-field .value')[2]?.textContent || '');
    if (phone === null) return;
    
    UI.showLoading();
    
    Api.updateProfile({ fullName, phone }).then(result => {
        UI.hideLoading();
        if (result.success) {
            UI.showToast('Profile updated successfully!', 'success');
            loadProfile();
        } else {
            UI.showToast(result.message || 'Failed to update profile', 'error');
        }
    });
}

function showChangePasswordModal() {
    // Create a simple password change prompt
    const currentPassword = prompt('Enter your current password:');
    if (currentPassword === null) return;
    
    const newPassword = prompt('Enter your new password (min 8 characters):');
    if (newPassword === null) return;
    
    if (newPassword.length < 8) {
        UI.showToast('Password must be at least 8 characters', 'error');
        return;
    }
    
    const confirmNewPassword = prompt('Confirm your new password:');
    if (confirmNewPassword === null) return;
    
    if (newPassword !== confirmNewPassword) {
        UI.showToast('Passwords do not match', 'error');
        return;
    }
    
    UI.showLoading();
    
    Api.changePassword({ currentPassword, newPassword, confirmNewPassword }).then(result => {
        UI.hideLoading();
        if (result.success) {
            UI.showToast('Password changed successfully!', 'success');
        } else {
            UI.showToast(result.message || 'Failed to change password', 'error');
        }
    });
}