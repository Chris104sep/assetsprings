// ============================================================
// TRANSACTIONS
// ============================================================

let allTransactions = [];

async function loadTransactions() {
    UI.showLoading();
    
    try {
        const result = await Api.getTransactions({ filter: 'ALL' });
        if (!result.success) {
            UI.showToast(result.message || 'Failed to load transactions', 'error');
            return;
        }
        
        allTransactions = result.data || [];
        renderTransactions(allTransactions);
    } catch (error) {
        console.error('Transactions error:', error);
        UI.showToast('Error loading transactions', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderTransactions(transactions) {
    const container = document.getElementById('transaction-list');
    
    if (!transactions || transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-light);">
                <i class="fas fa-list-ul" style="font-size: 48px; margin-bottom: 16px; display: block; opacity: 0.3;"></i>
                <p>No transactions yet.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = transactions.map(t => `
        <div class="list-item">
            <div class="item-left">
                <div class="title">${t.description || t.type}</div>
                <div class="subtitle">${formatDate(t.createdAt)}</div>
                <div class="subtitle">Reference: ${t.reference || 'N/A'}</div>
            </div>
            <div class="item-right">
                ${formatAmount(t.amount, t.type)}
                ${getStatusBadge(t.status || 'COMPLETED')}
            </div>
        </div>
    `).join('');
}

function filterTransactions() {
    const filter = document.getElementById('transaction-filter').value;
    
    if (filter === 'ALL') {
        renderTransactions(allTransactions);
    } else {
        const filtered = allTransactions.filter(t => t.type === filter);
        renderTransactions(filtered);
    }
}