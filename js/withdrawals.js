// ============================================================
// WITHDRAWALS
// ============================================================

async function loadWithdrawals() {
    UI.showLoading();
    
    try {
        const result = await Api.getWithdrawals();
        if (!result.success) {
            UI.showToast(result.message || 'Failed to load withdrawals', 'error');
            return;
        }
        
        renderWithdrawals(result.data);
    } catch (error) {
        console.error('Withdrawals error:', error);
        UI.showToast('Error loading withdrawals', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderWithdrawals(withdrawals) {
    const container = document.getElementById('withdrawal-list');
    
    if (!withdrawals || withdrawals.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-light);">
                <i class="fas fa-arrow-up" style="font-size: 48px; margin-bottom: 16px; display: block; opacity: 0.3;"></i>
                <p>No withdrawals yet.</p>
                <button class="btn btn-primary" style="margin-top: 16px;" onclick="showWithdrawalModal()">
                    <i class="fas fa-plus"></i> Request Withdrawal
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = withdrawals.map(w => `
        <div class="list-item">
            <div class="item-left">
                <div class="title">${w.asset || 'Crypto'} Withdrawal</div>
                <div class="subtitle">${formatDate(w.submittedAt)}</div>
                <div class="subtitle">${w.network || 'N/A'}</div>
            </div>
            <div class="item-right">
                <div class="amount negative">- ${formatCurrency(w.amount)}</div>
                ${getStatusBadge(w.status)}
            </div>
        </div>
    `).join('');
}

function showWithdrawalModal() {
    document.getElementById('withdrawal-form').reset();
    openModal('withdrawal-modal');
}

async function handleWithdrawalSubmit(event) {
    event.preventDefault();
    
    const amount = document.getElementById('withdrawal-amount').value;
    const withdrawalMethod = document.getElementById('withdrawal-method').value;
    const network = document.getElementById('withdrawal-network').value;
    const walletAddress = document.getElementById('withdrawal-address').value.trim();
    const notes = document.getElementById('withdrawal-notes').value.trim();
    
    const btn = event.target.querySelector('button[type="submit"]');
    
    if (!amount || !withdrawalMethod || !network || !walletAddress) {
        UI.showToast('Please fill in all required fields', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    
    const result = await Api.submitWithdrawal({
        amount: parseFloat(amount),
        withdrawalMethod,
        network,
        walletAddress,
        notes
    });
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Request Withdrawal';
    
    if (result.success) {
        UI.showToast('Withdrawal request submitted successfully!', 'success');
        closeModal('withdrawal-modal');
        loadWithdrawals();
        loadDashboardContent();
    } else {
        UI.showToast(result.message || 'Failed to submit withdrawal', 'error');
    }
}

// ============================================================
// WITHDRAWALS - Additional admin functions
// ============================================================

// Add this to the existing withdrawals.js file

async function getAllWithdrawals() {
    const result = await Api.getAllWithdrawals();
    return result;
}