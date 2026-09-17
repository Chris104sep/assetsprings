// ============================================================
// INVESTMENTS
// ============================================================

async function loadInvestments() {
    UI.showLoading();
    
    try {
        // Load investment plans
        const plansResult = await Api.getInvestmentPlans();
        if (plansResult.success) {
            renderInvestmentPlans(plansResult.data);
        }
        
        // Load user investments
        const investmentsResult = await Api.getInvestments();
        if (investmentsResult.success) {
            renderInvestments(investmentsResult.data);
        }
    } catch (error) {
        console.error('Investments error:', error);
        UI.showToast('Error loading investments', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderInvestmentPlans(plans) {
    const container = document.getElementById('investment-plans');
    
    if (!plans || plans.length === 0) {
        container.innerHTML = '<p style="color: var(--text-light);">No investment plans available.</p>';
        return;
    }
    
    container.innerHTML = plans.map(plan => `
        <div class="plan-card">
            <div class="plan-name">${plan.name}</div>
            <div class="plan-return">${plan.expectedReturn || 'N/A'}</div>
            <div class="plan-details">
                Min: ${formatCurrency(plan.minAmount)} | Max: ${formatCurrency(plan.maxAmount)}
            </div>
            <div class="plan-details">Duration: ${plan.duration || 'N/A'} days</div>
            <div class="plan-description">${plan.description || ''}</div>
            <button class="btn btn-primary btn-block" onclick="showInvestmentModal('${plan.id}')">
                <i class="fas fa-rocket"></i> Invest
            </button>
        </div>
    `).join('');
}

function renderInvestments(investments) {
    const container = document.getElementById('investment-list');
    
    if (!investments || investments.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-light);">
                <i class="fas fa-chart-line" style="font-size: 48px; margin-bottom: 16px; display: block; opacity: 0.3;"></i>
                <p>No active investments.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = investments.map(inv => `
        <div class="list-item">
            <div class="item-left">
                <div class="title">Investment #${inv.id}</div>
                <div class="subtitle">Started: ${formatDate(inv.startDate)}</div>
                <div class="subtitle">Expected Return: ${inv.expectedReturn || 'N/A'}</div>
            </div>
            <div class="item-right">
                <div class="amount">${formatCurrency(inv.amount)}</div>
                ${getStatusBadge(inv.status)}
            </div>
        </div>
    `).join('');
}

function showInvestmentModal(planId) {
    const select = document.getElementById('investment-plan');
    // Populate plans
    const plans = document.querySelectorAll('.plan-card');
    select.innerHTML = '';
    plans.forEach(card => {
        const name = card.querySelector('.plan-name')?.textContent || 'Unknown';
        const id = card.querySelector('button')?.onclick?.toString().match(/'([^']+)'/)?.[1] || '';
        if (id) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            select.appendChild(option);
        }
    });
    
    if (planId) {
        select.value = planId;
    }
    
    document.getElementById('investment-form').reset();
    openModal('investment-modal');
}

async function handleInvestmentSubmit(event) {
    event.preventDefault();
    
    const planId = document.getElementById('investment-plan').value;
    const amount = document.getElementById('investment-amount').value;
    
    const btn = event.target.querySelector('button[type="submit"]');
    
    if (!planId || !amount) {
        UI.showToast('Please select a plan and enter an amount', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    const result = await Api.createInvestment({
        planId,
        amount: parseFloat(amount)
    });
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-rocket"></i> Invest Now';
    
    if (result.success) {
        UI.showToast('Investment created successfully!', 'success');
        closeModal('investment-modal');
        loadInvestments();
        loadDashboardContent();
    } else {
        UI.showToast(result.message || 'Failed to create investment', 'error');
    }
}