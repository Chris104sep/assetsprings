// ============================================================
// ADMIN FUNCTIONS
// ============================================================

// ============================================================
// ADMIN - USERS
// ============================================================

async function loadAdminUsers() {
    if (!Auth.isAdmin()) {
        UI.showToast('Unauthorized access', 'error');
        return;
    }
    
    UI.showLoading();
    
    try {
        const result = await Api.getAllUsers();
        if (!result.success) {
            UI.showToast(result.message || 'Failed to load users', 'error');
            return;
        }
        
        renderUsers(result.data);
    } catch (error) {
        console.error('Users error:', error);
        UI.showToast('Error loading users', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('users-table-body');
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(u => `
        <tr>
            <td><strong>${u.fullName}</strong><br><small style="color: var(--text-light);">${u.username}</small></td>
            <td>${u.email}</td>
            <td><span class="status-badge ${u.role === 'SUPER_ADMIN' ? 'approved' : u.role === 'ADMIN' ? 'active' : 'pending'}">${u.role}</span></td>
            <td>${formatCurrency(u.balance)}</td>
            <td>${getStatusBadge(u.status)}</td>
            <td>${formatDate(u.createdAt)}</td>
        </tr>
    `).join('');
}

// ============================================================
// ADMIN - DEPOSITS
// ============================================================

async function loadAdminDeposits() {
    if (!Auth.isAdmin()) {
        UI.showToast('Unauthorized access', 'error');
        return;
    }
    
    UI.showLoading();
    
    try {
        const result = await Api.getAllDeposits();
        if (!result.success) {
            UI.showToast(result.message || 'Failed to load deposits', 'error');
            return;
        }
        
        renderAdminDeposits(result.data);
    } catch (error) {
        console.error('Admin deposits error:', error);
        UI.showToast('Error loading deposits', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderAdminDeposits(deposits) {
    const tbody = document.getElementById('admin-deposits-body');
    
    if (!deposits || deposits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">No deposits found</td></tr>';
        return;
    }
    
    tbody.innerHTML = deposits.map(d => `
        <tr>
            <td><small>${d.userId || 'N/A'}</small></td>
            <td>${formatCurrency(d.amount)}</td>
            <td>${d.asset || 'N/A'}</td>
            <td>${getStatusBadge(d.status)}</td>
            <td>${formatDate(d.submittedAt)}</td>
            <td>
                ${d.status === 'PENDING' ? `
                    <button class="btn btn-success btn-sm" onclick="adminApproveDeposit('${d.id}')">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="adminRejectDeposit('${d.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                ` : '—'}
            </td>
        </tr>
    `).join('');
}

async function adminApproveDeposit(depositId) {
    UI.confirm('Approve Deposit', 'Are you sure you want to approve this deposit?', async () => {
        UI.showLoading();
        
        try {
            const result = await Api.approveDeposit({ depositId });
            if (result.success) {
                UI.showToast('Deposit approved successfully!', 'success');
                loadAdminDeposits();
            } else {
                UI.showToast(result.message || 'Failed to approve deposit', 'error');
            }
        } catch (error) {
            console.error('Approve deposit error:', error);
            UI.showToast('Error approving deposit', 'error');
        } finally {
            UI.hideLoading();
        }
    });
}

async function adminRejectDeposit(depositId) {
    const reason = prompt('Enter rejection reason:');
    if (reason === null) return; // Cancelled
    
    if (!reason.trim()) {
        UI.showToast('Rejection reason is required', 'error');
        return;
    }
    
    UI.confirm('Reject Deposit', 'Are you sure you want to reject this deposit?', async () => {
        UI.showLoading();
        
        try {
            const result = await Api.rejectDeposit({ depositId, rejectionReason: reason });
            if (result.success) {
                UI.showToast('Deposit rejected', 'info');
                loadAdminDeposits();
            } else {
                UI.showToast(result.message || 'Failed to reject deposit', 'error');
            }
        } catch (error) {
            console.error('Reject deposit error:', error);
            UI.showToast('Error rejecting deposit', 'error');
        } finally {
            UI.hideLoading();
        }
    });
}

// ============================================================
// ADMIN - WITHDRAWALS
// ============================================================

async function loadAdminWithdrawals() {
    if (!Auth.isAdmin()) {
        UI.showToast('Unauthorized access', 'error');
        return;
    }
    
    UI.showLoading();
    
    try {
        const result = await Api.getAllWithdrawals();
        if (!result.success) {
            UI.showToast(result.message || 'Failed to load withdrawals', 'error');
            return;
        }
        
        renderAdminWithdrawals(result.data);
    } catch (error) {
        console.error('Admin withdrawals error:', error);
        UI.showToast('Error loading withdrawals', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderAdminWithdrawals(withdrawals) {
    const tbody = document.getElementById('admin-withdrawals-body');
    
    if (!withdrawals || withdrawals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">No withdrawals found</td></tr>';
        return;
    }
    
    tbody.innerHTML = withdrawals.map(w => `
        <tr>
            <td><small>${w.userId || 'N/A'}</small></td>
            <td>${formatCurrency(w.amount)}</td>
            <td>${w.asset || 'N/A'}</td>
            <td>${getStatusBadge(w.status)}</td>
            <td>${formatDate(w.submittedAt)}</td>
            <td>
                ${w.status === 'PENDING' ? `
                    <button class="btn btn-success btn-sm" onclick="adminApproveWithdrawal('${w.id}')">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="adminRejectWithdrawal('${w.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                ` : '—'}
            </td>
        </tr>
    `).join('');
}

async function adminApproveWithdrawal(withdrawalId) {
    UI.confirm('Approve Withdrawal', 'Are you sure you want to approve this withdrawal?', async () => {
        UI.showLoading();
        
        try {
            const result = await Api.approveWithdrawal({ withdrawalId });
            if (result.success) {
                UI.showToast('Withdrawal approved successfully!', 'success');
                loadAdminWithdrawals();
            } else {
                UI.showToast(result.message || 'Failed to approve withdrawal', 'error');
            }
        } catch (error) {
            console.error('Approve withdrawal error:', error);
            UI.showToast('Error approving withdrawal', 'error');
        } finally {
            UI.hideLoading();
        }
    });
}

async function adminRejectWithdrawal(withdrawalId) {
    const reason = prompt('Enter rejection reason:');
    if (reason === null) return;
    
    if (!reason.trim()) {
        UI.showToast('Rejection reason is required', 'error');
        return;
    }
    
    UI.confirm('Reject Withdrawal', 'Are you sure you want to reject this withdrawal?', async () => {
        UI.showLoading();
        
        try {
            const result = await Api.rejectWithdrawal({ withdrawalId, rejectionReason: reason });
            if (result.success) {
                UI.showToast('Withdrawal rejected', 'info');
                loadAdminWithdrawals();
            } else {
                UI.showToast(result.message || 'Failed to reject withdrawal', 'error');
            }
        } catch (error) {
            console.error('Reject withdrawal error:', error);
            UI.showToast('Error rejecting withdrawal', 'error');
        } finally {
            UI.hideLoading();
        }
    });
}

// ============================================================
// ADMIN - TESTIMONIALS
// ============================================================

// ============================================================
// ADMIN - TESTIMONIALS (super_admin only)
// ============================================================
// Frontend role checks below are a UX convenience (avoid showing a broken
// page to the wrong role) — the actual enforcement happens server-side on
// every testimonial-management action, per the backend's role check.

async function loadAdminTestimonials() {
    if (!Auth.isSuperAdmin()) {
        UI.showToast('Unauthorized access', 'error');
        return;
    }
    
    UI.showLoading();
    
    try {
        const result = await Api.getTestimonials();
        if (!result.success) {
            UI.showToast(result.message || 'Failed to load testimonials', 'error');
            return;
        }
        
        renderAdminTestimonials(result.data);
    } catch (error) {
        console.error('Admin testimonials error:', error);
        UI.showToast('Error loading testimonials', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderAdminTestimonials(testimonials) {
    const tbody = document.getElementById('testimonials-body');
    
    if (!testimonials || testimonials.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-light);">No testimonials found</td></tr>';
        return;
    }
    
    tbody.innerHTML = testimonials.map(t => `
        <tr>
            <td><strong>${escapeHtml(t.userName || t.name || 'Member')}</strong></td>
            <td style="max-width: 300px; word-break: break-word;">${escapeHtml(t.testimonial || t.message || '')}</td>
            <td>${getStatusBadge((t.status || 'pending').toUpperCase())}</td>
            <td style="white-space: nowrap;">
                ${(t.status || '').toLowerCase() === 'pending' ? `
                    <button class="btn btn-success btn-sm" onclick="approveTestimonial('${t.id}')" title="Approve">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="rejectTestimonial('${t.id}')" title="Reject">
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
                <button class="btn btn-outline btn-sm" onclick="editTestimonial('${t.id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteTestimonial('${t.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function approveTestimonial(id) {
    UI.confirm('Approve Testimonial', 'This testimonial will become publicly visible. Continue?', async () => {
        UI.showLoading();
        try {
            const result = await Api.updateTestimonial({ testimonialId: id, status: 'approved' });
            if (result.success) {
                UI.showToast('Testimonial approved and is now public', 'success');
                loadAdminTestimonials();
            } else {
                UI.showToast(result.message || 'Failed to approve testimonial', 'error');
            }
        } catch (error) {
            console.error('Approve testimonial error:', error);
            UI.showToast('Error approving testimonial', 'error');
        } finally {
            UI.hideLoading();
        }
    });
}

async function rejectTestimonial(id) {
    UI.confirm('Reject Testimonial', 'This testimonial will not be shown publicly. Continue?', async () => {
        UI.showLoading();
        try {
            const result = await Api.updateTestimonial({ testimonialId: id, status: 'rejected' });
            if (result.success) {
                UI.showToast('Testimonial rejected', 'info');
                loadAdminTestimonials();
            } else {
                UI.showToast(result.message || 'Failed to reject testimonial', 'error');
            }
        } catch (error) {
            console.error('Reject testimonial error:', error);
            UI.showToast('Error rejecting testimonial', 'error');
        } finally {
            UI.hideLoading();
        }
    });
}

function showTestimonialModal() {
    document.getElementById('testimonial-modal-title').textContent = 'Add Testimonial';
    document.getElementById('testimonial-edit-id').value = '';
    document.getElementById('testimonial-form').reset();
    document.getElementById('testimonial-status').value = 'approved';
    openModal('testimonial-modal');
}

function editTestimonial(id) {
    // Find the testimonial in the list
    const row = document.querySelector(`#testimonials-body tr button[onclick*="editTestimonial('${id}')"]`)?.closest('tr');
    if (!row) return;
    
    const cells = row.querySelectorAll('td');
    const name = cells[0]?.textContent || '';
    const message = cells[1]?.textContent || '';
    const status = (cells[2]?.querySelector('.status-badge')?.textContent || 'PENDING').toLowerCase();
    
    document.getElementById('testimonial-modal-title').textContent = 'Edit Testimonial';
    document.getElementById('testimonial-edit-id').value = id;
    document.getElementById('testimonial-name').value = name;
    document.getElementById('testimonial-message').value = message;
    document.getElementById('testimonial-status').value = status;
    openModal('testimonial-modal');
}

async function handleTestimonialSubmit(event) {
    event.preventDefault();
    
    const id = document.getElementById('testimonial-edit-id').value;
    const name = document.getElementById('testimonial-name').value.trim();
    const message = document.getElementById('testimonial-message').value.trim();
    const status = document.getElementById('testimonial-status').value;
    
    const btn = event.target.querySelector('button[type="submit"]');
    
    if (!name || !message) {
        UI.showToast('Name and message are required', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    let result;
    if (id) {
        result = await Api.updateTestimonial({ testimonialId: id, userName: name, testimonial: message, status });
    } else {
        // An admin-authored testimonial is created directly with the chosen
        // status (e.g. pre-approved) rather than starting as pending, since
        // the super admin creating it IS the review step.
        result = await Api.createTestimonial({ userName: name, testimonial: message, status });
    }
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save Testimonial';
    
    if (result.success) {
        UI.showToast('Testimonial saved successfully!', 'success');
        closeModal('testimonial-modal');
        loadAdminTestimonials();
    } else {
        UI.showToast(result.message || 'Failed to save testimonial', 'error');
    }
}

function deleteTestimonial(id) {
    UI.confirm('Delete Testimonial', 'Are you sure you want to delete this testimonial?', async () => {
        UI.showLoading();
        
        try {
            const result = await Api.deleteTestimonial({ testimonialId: id });
            if (result.success) {
                UI.showToast('Testimonial deleted', 'info');
                loadAdminTestimonials();
            } else {
                UI.showToast(result.message || 'Failed to delete testimonial', 'error');
            }
        } catch (error) {
            console.error('Delete testimonial error:', error);
            UI.showToast('Error deleting testimonial', 'error');
        } finally {
            UI.hideLoading();
        }
    });
}

// ============================================================
// ADMIN - NEWSLETTER
// ============================================================

async function loadAdminNewsletter() {
    if (!Auth.isSuperAdmin()) {
        UI.showToast('Unauthorized access', 'error');
        return;
    }
    
    UI.showLoading();
    
    try {
        const result = await Api.getNewsletter();
        if (!result.success) {
            UI.showToast(result.message || 'Failed to load newsletter', 'error');
            return;
        }
        
        renderNewsletter(result.data);
    } catch (error) {
        console.error('Newsletter error:', error);
        UI.showToast('Error loading newsletter', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderNewsletter(newsletters) {
    const container = document.getElementById('newsletter-list');
    
    if (!newsletters || newsletters.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-light);">
                <i class="fas fa-newspaper" style="font-size: 48px; margin-bottom: 16px; display: block; opacity: 0.3;"></i>
                <p>No newsletters published yet.</p>
                <button class="btn btn-primary" style="margin-top: 16px;" onclick="showNewsletterModal()">
                    <i class="fas fa-plus"></i> Publish Newsletter
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = newsletters.map(n => `
        <div class="list-item">
            <div class="item-left">
                <div class="title">${n.title}</div>
                <div class="subtitle">${n.content}</div>
                <div class="subtitle">Published: ${formatDate(n.publishedAt)}</div>
            </div>
            <div class="item-right">
                <span class="status-badge approved">Published</span>
            </div>
        </div>
    `).join('');
}

function showNewsletterModal() {
    document.getElementById('newsletter-form').reset();
    openModal('newsletter-modal');
}

async function handleNewsletterSubmit(event) {
    event.preventDefault();
    
    const title = document.getElementById('newsletter-title').value.trim();
    const content = document.getElementById('newsletter-content').value.trim();
    
    const btn = event.target.querySelector('button[type="submit"]');
    
    if (!title || !content) {
        UI.showToast('Title and content are required', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';
    
    const result = await Api.publishNewsletter({ title, content });
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish';
    
    if (result.success) {
        UI.showToast('Newsletter published successfully!', 'success');
        closeModal('newsletter-modal');
        loadAdminNewsletter();
    } else {
        UI.showToast(result.message || 'Failed to publish newsletter', 'error');
    }
}