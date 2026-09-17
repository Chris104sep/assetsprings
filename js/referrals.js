// ============================================================
// REFERRALS
// ============================================================

async function loadReferrals() {
    UI.showLoading();
    
    try {
        const result = await Api.getReferralData();
        if (!result.success) {
            UI.showToast(result.message || 'Failed to load referral data', 'error');
            return;
        }
        
        renderReferrals(result.data);
    } catch (error) {
        console.error('Referrals error:', error);
        UI.showToast('Error loading referrals', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderReferrals(data) {
    const container = document.getElementById('referral-info');
    
    container.innerHTML = `
        <div class="referral-code-box">
            <div style="font-size: 14px; color: var(--text-light);">Your Referral Code</div>
            <div class="code">${data.referralCode || 'N/A'}</div>
            <button class="copy-btn" onclick="copyToClipboard('${data.referralCode || ''}')">
                <i class="fas fa-copy"></i> Copy
            </button>
        </div>
        <div class="referral-code-box">
            <div style="font-size: 14px; color: var(--text-light);">Referral Link</div>
            <div style="font-size: 13px; word-break: break-all; margin: 8px 0; background: var(--bg-light); padding: 8px; border-radius: var(--radius-sm);">
                ${data.referralLink || 'N/A'}
            </div>
            <button class="copy-btn" onclick="copyToClipboard('${data.referralLink || ''}')">
                <i class="fas fa-copy"></i> Copy
            </button>
        </div>
        <div class="referral-code-box">
            <div style="font-size: 14px; color: var(--text-light);">Total Referrals</div>
            <div style="font-size: 32px; font-weight: 800; color: var(--primary);">${data.totalReferrals || 0}</div>
        </div>
        <div class="referral-code-box">
            <div style="font-size: 14px; color: var(--text-light);">Total Rewards</div>
            <div style="font-size: 32px; font-weight: 800; color: var(--accent);">${formatCurrency(data.totalRewards || 0)}</div>
        </div>
    `;
}