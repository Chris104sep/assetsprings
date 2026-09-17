// ============================================================
// UI UTILITIES
// ============================================================

const UI = {
    showLoading() {
        document.getElementById('loading-overlay').style.display = 'flex';
    },
    
    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    },
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },
    
    confirm(title, message, onConfirm) {
        const modal = document.getElementById('confirmation-modal');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        
        const btn = document.getElementById('confirm-action-btn');
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', () => {
            closeModal('confirmation-modal');
            if (onConfirm) onConfirm();
        });
        
        openModal('confirmation-modal');
    }
};

function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // Show target page
    const page = document.getElementById(`page-${pageId}`);
    if (page) {
        page.classList.add('active');
    }
    
    // Scroll to top
    window.scrollTo(0, 0);

    // Public pages that need fresh data every time they're shown, not just
    // on first load. Centralized here (rather than scattered across every
    // onclick that navigates) so a page can't be added later without its
    // loader being wired up.
    switch (pageId) {
        case 'welcome':
            loadWelcomeTestimonials();
            break;
        case 'testimonials':
            loadTestimonialsPage();
            break;
    }
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('open');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('open');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            UI.showToast('Copied to clipboard!', 'success');
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    UI.showToast('Copied to clipboard!', 'success');
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function getStatusBadge(status) {
    const map = {
        'PENDING': 'pending',
        'APPROVED': 'approved',
        'REJECTED': 'rejected',
        'COMPLETED': 'completed',
        'ACTIVE': 'active',
        'SUSPENDED': 'suspended'
    };
    return `<span class="status-badge ${map[status] || 'pending'}">${status}</span>`;
}

function formatAmount(amount, type) {
    const formatted = formatCurrency(amount);
    if (type === 'DEPOSIT' || type === 'WITHDRAWAL') {
        return `<span class="amount ${type === 'DEPOSIT' ? 'positive' : 'negative'}">${type === 'DEPOSIT' ? '+' : '-'} ${formatted}</span>`;
    }
    return formatted;
}

function getInitials(name) {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}