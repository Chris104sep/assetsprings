// ============================================================
// SAVINGS
// ============================================================

// Cache of the user's goals for the Add Funds modal's select list, and the
// available balance last seen — refreshed every time the modal is opened.
let cachedSavingsGoals = [];

async function loadSavings() {
    UI.showLoading();
    
    try {
        const result = await Api.getSavingsGoals();
        if (!result.success) {
            UI.showToast(result.message || 'Failed to load savings goals', 'error');
            return;
        }
        
        cachedSavingsGoals = result.data || [];
        renderSavingsGoals(result.data);
    } catch (error) {
        console.error('Savings error:', error);
        UI.showToast('Error loading savings goals', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderSavingsGoals(goals) {
    const container = document.getElementById('savings-goals');
    
    if (!goals || goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-light); grid-column: 1 / -1;">
                <i class="fas fa-piggy-bank" style="font-size: 48px; margin-bottom: 16px; display: block; opacity: 0.3;"></i>
                <p>No savings goals yet.</p>
                <button class="btn btn-primary" style="margin-top: 16px;" onclick="showSavingsModal()">
                    <i class="fas fa-plus"></i> Create Goal
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = goals.map(goal => `
        <div class="goal-card">
            <div class="goal-name">${goal.name}</div>
            <div class="goal-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${goal.progress || 0}%;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--text-light); margin-top: 4px;">
                    <span>${goal.progress || 0}%</span>
                    <span>Target: ${formatCurrency(goal.targetAmount)}</span>
                </div>
            </div>
            <div class="goal-stats">
                <span>Saved: <span class="amount">${formatCurrency(goal.currentAmount)}</span></span>
                <span>Remaining: <span class="amount">${formatCurrency(goal.remaining)}</span></span>
            </div>
            <div style="margin-top: 12px; display: flex; gap: 8px;">
                <button class="btn btn-primary btn-sm" onclick="showAddFundsModal('${goal.id}')">
                    <i class="fas fa-plus"></i> Add Funds
                </button>
                <span style="font-size: 12px; color: var(--text-light); align-self: center;">
                    Due: ${formatDate(goal.targetDate)}
                </span>
            </div>
        </div>
    `).join('');
}

function showSavingsModal() {
    document.getElementById('savings-form').reset();
    // Set min date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('savings-date').min = tomorrow.toISOString().split('T')[0];
    openModal('savings-modal');
}

async function handleSavingsSubmit(event) {
    event.preventDefault();
    
    const goalName = document.getElementById('savings-name').value.trim();
    const targetAmount = document.getElementById('savings-target').value;
    const targetDate = document.getElementById('savings-date').value;
    
    const btn = event.target.querySelector('button[type="submit"]');
    
    if (!goalName || !targetAmount || !targetDate) {
        UI.showToast('Please fill in all fields', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    
    const result = await Api.createSavingsGoal({
        goalName,
        targetAmount: parseFloat(targetAmount),
        targetDate
    });
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-plus"></i> Create Goal';
    
    if (result.success) {
        UI.showToast('Savings goal created successfully!', 'success');
        closeModal('savings-modal');
        loadSavings();
        loadDashboardContent();
    } else {
        UI.showToast(result.message || 'Failed to create savings goal', 'error');
    }
}

// ============================================================
// ADD FUNDS (fund a savings goal from the user's available balance)
// ============================================================

// Tracks the available balance currently shown in the Add Funds modal, so
// the amount field and the "use full balance" shortcut can be validated
// against it client-side. The backend re-validates independently — this is
// only for a responsive UI, never the source of truth.
let currentAvailableBalance = 0;

async function showAddFundsModal(preselectGoalId) {
    document.getElementById('savings-fund-form').reset();
    openModal('savings-fund-modal');

    const balanceEl = document.getElementById('fund-available-balance');
    const select = document.getElementById('fund-goal-select');
    const amountInput = document.getElementById('fund-amount');
    const submitBtn = document.getElementById('fund-submit-btn');

    balanceEl.textContent = 'Loading…';
    select.innerHTML = '<option>Loading goals…</option>';
    submitBtn.disabled = true;

    try {
        // Available balance and the goal list can both change between page
        // loads, so refresh both every time the modal opens.
        const [dashboardResult, goalsResult] = await Promise.all([
            Api.getDashboard(),
            Api.getSavingsGoals()
        ]);

        if (!dashboardResult.success) {
            UI.showToast(dashboardResult.message || 'Failed to load balance', 'error');
            closeModal('savings-fund-modal');
            return;
        }

        currentAvailableBalance = dashboardResult.data.user.balance || 0;
        balanceEl.textContent = formatCurrency(currentAvailableBalance);
        amountInput.max = currentAvailableBalance;

        const goals = (goalsResult.success && goalsResult.data) ? goalsResult.data : [];
        cachedSavingsGoals = goals;

        if (goals.length === 0) {
            select.innerHTML = '<option value="">No savings goals yet</option>';
            UI.showToast('Create a savings goal first, then add funds to it.', 'info');
            return;
        }

        select.innerHTML = goals.map(g =>
            `<option value="${g.id}">${escapeHtml(g.name)} (Saved: ${formatCurrency(g.currentAmount)})</option>`
        ).join('');

        if (preselectGoalId) {
            select.value = preselectGoalId;
        }

        submitBtn.disabled = currentAvailableBalance <= 0;
        if (currentAvailableBalance <= 0) {
            UI.showToast('Your available balance is $0. Make a deposit first.', 'info');
        }
    } catch (error) {
        console.error('Add funds modal error:', error);
        UI.showToast('Error loading balance and goals', 'error');
        closeModal('savings-fund-modal');
    }
}

function useMaxFundAmount(event) {
    event.preventDefault();
    document.getElementById('fund-amount').value = currentAvailableBalance > 0
        ? currentAvailableBalance.toFixed(2)
        : '';
}

async function handleAddFundsSubmit(event) {
    event.preventDefault();

    const goalId = document.getElementById('fund-goal-select').value;
    const amount = parseFloat(document.getElementById('fund-amount').value);
    const btn = document.getElementById('fund-submit-btn');

    if (!goalId) {
        UI.showToast('Please select a savings goal', 'error');
        return;
    }

    // Client-side validation mirrors the mandatory server-side checks —
    // amount must be positive and cannot exceed the available balance.
    // This is purely for responsiveness; the backend enforces it for real.
    if (isNaN(amount) || amount <= 0) {
        UI.showToast('Please enter an amount greater than zero', 'error');
        return;
    }

    if (amount > currentAvailableBalance) {
        UI.showToast('Amount cannot exceed your available balance', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const result = await Api.fundSavingsGoal({ goalId, amount });

        if (result.success) {
            UI.showToast(
                `Savings goal funded successfully. ${formatCurrency(amount)} has been added to your savings goal.`,
                'success'
            );
            closeModal('savings-fund-modal');
            loadSavings();
            loadDashboardContent();
        } else {
            UI.showToast(result.message || 'Failed to fund savings goal', 'error');
        }
    } catch (error) {
        console.error('Fund savings goal error:', error);
        UI.showToast('Error funding savings goal', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Confirm Transfer';
    }
}