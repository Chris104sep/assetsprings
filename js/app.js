document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.ws-footer-year').forEach(el => {
        el.textContent = new Date().getFullYear();
    });
});

// ============================================================
// APPLICATION INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {
    // Check for reset token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    if (resetToken) {
        // Show reset password page
        showPage('reset-password');
        // Store token for use in reset form
        document.getElementById('reset-password-form').dataset.token = resetToken;
    }
    
    // Check if user is authenticated
    const session = Auth.getSession();
    if (session) {
        const isValid = await validateSession();
        if (isValid) {
            loadDashboard();
            return;
        } else {
            Auth.clearSession();
        }
    }
    
    // Show welcome page
    // (showPage triggers loadWelcomeTestimonials() itself now — see ui.js)
    showPage('welcome');
});

// ============================================================
// WELCOME PAGE
// ============================================================

async function loadWelcomeTestimonials() {
    try {
        const result = await Api.getPublicTestimonials();
        const group1 = document.getElementById('welcome-marquee-group-1');
        const group2 = document.getElementById('welcome-marquee-group-2');
        if (!group1 || !group2) return;

        if (result.success && result.data && result.data.length > 0) {
            const cardsHtml = result.data.map(t => renderWelcomeTestimonialCard(t)).join('');
            // group2 is an exact duplicate of group1, marked aria-hidden — the
            // CSS marquee animates translateX(-50%) across the combined pair,
            // so the loop reads as continuous instead of snapping at the end.
            group1.innerHTML = cardsHtml;
            group2.innerHTML = cardsHtml;
        } else {
            // No testimonials yet — hide the section rather than show an
            // empty scrolling track.
            const section = group1.closest('.ws-testimonials');
            if (section) section.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading testimonials:', error);
    }
}

function welcomeTestimonialInitials(name) {
    if (!name) return '—';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
}

function renderWelcomeTestimonialCard(t) {
    // escapeHtml keeps this safe now that testimonial content can come from
    // any member, not just admins — never trust user-submitted text.
    const message = escapeHtml(t.testimonial || t.message || '');
    const name = escapeHtml(t.userName || t.name || 'Member');
    return `
        <div class="ws-t-card">
            <p class="ws-t-quote">"${message}"</p>
            <div class="ws-t-person">
                <div class="ws-t-avatar">${welcomeTestimonialInitials(t.userName || t.name)}</div>
                <div>
                    <div class="ws-t-name">${name}</div>
                    <div class="ws-t-role">AssetSpring member</div>
                </div>
            </div>
        </div>
    `;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================================
// STANDALONE TESTIMONIALS PAGE
// ============================================================
// This page (reached via the "Testimonials" nav link) previously had no
// loader wired up at all — #testimonials-grid stayed empty forever.
async function loadTestimonialsPage() {
    const grid = document.getElementById('testimonials-grid');
    if (!grid) return;

    grid.innerHTML = '<p style="color: var(--text-muted, #5c6b5d);">Loading testimonials…</p>';

    try {
        const result = await Api.getPublicTestimonials();
        if (result.success && result.data && result.data.length > 0) {
            grid.innerHTML = result.data.map(t => `
                <div class="testimonial-card">
                    <p class="quote">"${escapeHtml(t.testimonial || t.message || '')}"</p>
                    <div class="author">— ${escapeHtml(t.userName || t.name || 'Member')}</div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<p style="color: var(--text-muted, #5c6b5d);">No testimonials yet.</p>';
        }
    } catch (error) {
        console.error('Error loading testimonials page:', error);
        grid.innerHTML = '<p style="color: var(--text-muted, #5c6b5d);">Couldn\'t load testimonials right now.</p>';
    }
}

// ============================================================
// DASHBOARD LOADING
// ============================================================

async function loadDashboard() {
    const user = Auth.getUser();
    if (!user) {
        showPage('signin');
        return;
    }
    
    // Show dashboard container
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('dashboard-container').style.display = 'flex';
    
    // Update user info
    document.getElementById('user-name-display').textContent = user.name;
    document.getElementById('dashboard-user-name').textContent = user.name;
    
    // Show/hide admin menu items based on role
    const isAdmin = Auth.isAdmin();
    const isSuperAdmin = Auth.isSuperAdmin();
    
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? 'flex' : 'none';
    });
    
    document.querySelectorAll('.super-admin-only').forEach(el => {
        el.style.display = isSuperAdmin ? 'flex' : 'none';
    });
    
    // Load initial page
    navigateTo('dashboard');
    
    // Load notifications count
    loadNotificationBadge();
}

function navigateTo(page) {
    // Hide all dashboard pages
    document.querySelectorAll('.dashboard-page').forEach(p => p.classList.remove('active'));
    
    // Show target page
    const target = document.getElementById(`page-${page}`);
    if (target) {
        target.classList.add('active');
    }
    
    // Update nav
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    // Load page content
    switch(page) {
        case 'dashboard': loadDashboardContent(); break;
        case 'deposits': loadDeposits(); break;
        case 'withdrawals': loadWithdrawals(); break;
        case 'investments': loadInvestments(); break;
        case 'savings': loadSavings(); break;
        case 'transactions': loadTransactions(); break;
        case 'referrals': loadReferrals(); break;
        case 'profile': loadProfile(); break;
        case 'notifications': loadNotifications(); break;
        case 'admin-users': loadAdminUsers(); break;
        case 'admin-deposits': loadAdminDeposits(); break;
        case 'admin-withdrawals': loadAdminWithdrawals(); break;
        case 'admin-testimonials': loadAdminTestimonials(); break;
        case 'admin-newsletter': loadAdminNewsletter(); break;
    }
}

// ============================================================
// NAVIGATION
// ============================================================

// Sidebar navigation click handlers
document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        const page = this.dataset.page;
        if (page) {
            navigateTo(page);
            // Close sidebar on mobile
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
            }
        }
    });
});

// ============================================================
// REFRESH
// ============================================================

function refreshDashboard() {
    const activePage = document.querySelector('.dashboard-page.active');
    if (activePage) {
        const pageId = activePage.id.replace('page-', '');
        navigateTo(pageId);
        UI.showToast('Refreshed!', 'info');
    }
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener('keydown', function(e) {
    // Escape closes modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.open').forEach(modal => {
            modal.classList.remove('open');
        });
    }
});