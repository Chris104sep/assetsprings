// ============================================================
// DASHBOARD
// ============================================================

let savingsChartInstance = null;
let investmentChartInstance = null;

async function loadDashboardContent() {
    UI.showLoading();
    
    try {
        const result = await Api.getDashboard();
        if (!result.success) {
            UI.showToast(result.message || 'Failed to load dashboard', 'error');
            return;
        }
        
        const data = result.data;
        renderDashboardStats(data);
        renderRecentTransactions(data.recentTransactions);
        renderCharts(data);
        
    } catch (error) {
        console.error('Dashboard error:', error);
        UI.showToast('Error loading dashboard', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderDashboardStats(data) {
    const container = document.getElementById('dashboard-stats');
    
    const stats = [
        { label: 'Total Balance', value: formatCurrency(data.user.balance), icon: 'fa-wallet' },
        { label: 'Total Deposits', value: formatCurrency(data.totalDeposits), icon: 'fa-arrow-down' },
        { label: 'Total Withdrawals', value: formatCurrency(data.totalWithdrawals), icon: 'fa-arrow-up' },
        { label: 'Total Investments', value: formatCurrency(data.totalInvestmentAmount), icon: 'fa-chart-line' },
        { label: 'Total Savings', value: formatCurrency(data.totalSavingsCurrentAmount), icon: 'fa-piggy-bank' },
        { label: 'Active Investments', value: data.activeInvestments || 0, icon: 'fa-rocket' }
    ];
    
    // Add admin stats if available
    if (data.adminStats) {
        stats.push({ label: 'Total Users', value: data.adminStats.totalUsers, icon: 'fa-users' });
        stats.push({ label: 'Pending Deposits', value: data.adminStats.pendingDeposits, icon: 'fa-clock' });
        stats.push({ label: 'Pending Withdrawals', value: data.adminStats.pendingWithdrawals, icon: 'fa-clock' });
    }
    
    container.innerHTML = stats.map(stat => `
        <div class="stat-card-dashboard">
            <div class="stat-label"><i class="fas ${stat.icon}"></i> ${stat.label}</div>
            <div class="stat-value">${stat.value}</div>
        </div>
    `).join('');
}

function renderRecentTransactions(transactions) {
    const container = document.getElementById('recent-transactions');
    
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<p style="color: var(--text-light);">No recent transactions.</p>';
        return;
    }
    
    container.innerHTML = transactions.slice(0, 5).map(t => `
        <div class="list-item" style="margin-bottom: 8px;">
            <div class="item-left">
                <div class="title">${t.description || t.type}</div>
                <div class="subtitle">${formatDate(t.createdAt)}</div>
            </div>
            <div class="item-right">
                ${formatAmount(t.amount, t.type)}
                ${getStatusBadge(t.status || 'COMPLETED')}
            </div>
        </div>
    `).join('');
}

function renderCharts(data) {
    // Savings chart
    const savingsCtx = document.getElementById('savings-chart');
    if (savingsCtx) {
        if (savingsChartInstance) savingsChartInstance.destroy();
        
        // Generate sample data based on savings goals
        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const savingsData = labels.map(() => Math.round(Math.random() * 5000 + 1000));
        
        savingsChartInstance = new Chart(savingsCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Savings Growth',
                    data: savingsData,
                    borderColor: '#2ECC71',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Investment chart
    const investCtx = document.getElementById('investment-chart');
    if (investCtx) {
        if (investmentChartInstance) investmentChartInstance.destroy();
        
        const labels = ['Starter', 'Balanced', 'Premium', 'Long-Term'];
        const investData = [
            data.totalInvestmentAmount ? data.totalInvestmentAmount * 0.15 : 0,
            data.totalInvestmentAmount ? data.totalInvestmentAmount * 0.25 : 0,
            data.totalInvestmentAmount ? data.totalInvestmentAmount * 0.35 : 0,
            data.totalInvestmentAmount ? data.totalInvestmentAmount * 0.25 : 0
        ];
        
        investmentChartInstance = new Chart(investCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: investData,
                    backgroundColor: ['#2ECC71', '#3498DB', '#F39C12', '#E74C3C'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                cutout: '60%'
            }
        });
    }
}