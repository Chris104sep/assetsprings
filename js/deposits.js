// ============================================================
// DEPOSITS
// ============================================================

async function loadDeposits() {
    UI.showLoading();
    
    try {
        const result = await Api.getDeposits();
        if (!result.success) {
            UI.showToast(result.message || 'Failed to load deposits', 'error');
            return;
        }
        
        renderDeposits(result.data);
    } catch (error) {
        console.error('Deposits error:', error);
        UI.showToast('Error loading deposits', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderDeposits(deposits) {
    const container = document.getElementById('deposit-list');
    
    if (!deposits || deposits.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-light);">
                <i class="fas fa-arrow-down" style="font-size: 48px; margin-bottom: 16px; display: block; opacity: 0.3;"></i>
                <p>No deposits yet.</p>
                <button class="btn btn-primary" style="margin-top: 16px;" onclick="showDepositModal()">
                    <i class="fas fa-plus"></i> Make a Deposit
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = deposits.map(d => `
        <div class="list-item">
            <div class="item-left">
                <div class="title">${d.asset || 'Crypto'} Deposit</div>
                <div class="subtitle">${formatDate(d.submittedAt)}</div>
                <div class="subtitle">${d.network || 'N/A'}</div>
            </div>
            <div class="item-right">
                <div class="amount positive">+ ${formatCurrency(d.amount)}</div>
                ${getStatusBadge(d.status)}
            </div>
        </div>
    `).join('');
}

// Holds the currently displayed platform wallet address (fetched dynamically
// from the backend walletsettings sheet). Never hard-coded — see
// loadDepositWalletAddress(). Used to attach the address the funds were
// meant to be sent to on the submitted deposit record.
let currentDepositWallet = null;

function showDepositModal() {
    document.getElementById('deposit-form').reset();
    currentDepositWallet = null;
    openModal('deposit-modal');
    loadDepositWalletAddress();
}

async function loadDepositWalletAddress() {
    const box = document.getElementById('deposit-wallet-box');
    const addressEl = document.getElementById('deposit-wallet-address');
    const metaEl = document.getElementById('deposit-wallet-meta');
    const copyBtn = document.getElementById('deposit-wallet-copy-btn');
    const submitBtn = document.querySelector('#deposit-form button[type="submit"]');

    // Loading state
    box.classList.remove('error');
    box.querySelector('i').className = 'fas fa-spinner fa-spin';
    addressEl.textContent = 'Loading wallet address…';
    copyBtn.disabled = true;
    metaEl.textContent = '';
    if (submitBtn) submitBtn.disabled = true;

    try {
        const result = await Api.getWalletSettings();

        if (!result.success || !result.data || !result.data.walletAddress) {
            // Missing/unavailable wallet settings — handled gracefully,
            // the user is blocked from submitting until it's available.
            box.classList.add('error');
            box.querySelector('i').className = 'fas fa-exclamation-triangle';
            addressEl.textContent = 'Wallet address is currently unavailable. Please try again shortly or contact support.';
            currentDepositWallet = null;
            return;
        }

        currentDepositWallet = result.data;
        box.querySelector('i').className = 'fas fa-wallet';
        addressEl.textContent = result.data.walletAddress;
        copyBtn.disabled = false;
        metaEl.textContent = [result.data.network, result.data.currency]
            .filter(Boolean).join(' · ');
        if (submitBtn) submitBtn.disabled = false;
    } catch (error) {
        console.error('Wallet settings error:', error);
        box.classList.add('error');
        box.querySelector('i').className = 'fas fa-exclamation-triangle';
        addressEl.textContent = 'Could not load the wallet address. Please try again.';
        currentDepositWallet = null;
    }
}

async function handleDepositSubmit(event) {
    event.preventDefault();

    if (!currentDepositWallet || !currentDepositWallet.walletAddress) {
        UI.showToast('Wallet address is not available yet. Please wait or retry.', 'error');
        return;
    }

    const amount = document.getElementById('deposit-amount').value;
    const cryptocurrency = document.getElementById('deposit-asset').value;
    const network = document.getElementById('deposit-network').value;
    const transactionHash = document.getElementById('deposit-txhash').value.trim();
    const proofOfPayment = document.getElementById('deposit-proof').value.trim();
    const notes = document.getElementById('deposit-notes').value.trim();
    
    const btn = event.target.querySelector('button[type="submit"]');
    
    if (!amount || !cryptocurrency || !network || !transactionHash) {
        UI.showToast('Please fill in all required fields', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    
    const result = await Api.submitDeposit({
        amount: parseFloat(amount),
        cryptocurrency,
        network,
        walletAddress: currentDepositWallet.walletAddress,
        transactionHash,
        proofOfPayment,
        notes
    });
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Deposit';
    
    if (result.success) {
        UI.showToast('Deposit submitted successfully! Pending verification.', 'success');
        closeModal('deposit-modal');
        loadDeposits();
        // Also refresh dashboard
        loadDashboardContent();
    } else {
        UI.showToast(result.message || 'Failed to submit deposit', 'error');
    }
}