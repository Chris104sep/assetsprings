// ============================================================
// NOTIFICATIONS
// ============================================================

async function loadNotifications() {
    UI.showLoading();
    
    try {
        const result = await Api.getNotifications();
        if (!result.success) {
            UI.showToast(result.message || 'Failed to load notifications', 'error');
            return;
        }
        
        renderNotifications(result.data);
        updateNotificationBadge(result.data);
    } catch (error) {
        console.error('Notifications error:', error);
        UI.showToast('Error loading notifications', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderNotifications(notifications) {
    const container = document.getElementById('notification-list');
    
    if (!notifications || notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-light);">
                <i class="fas fa-bell" style="font-size: 48px; margin-bottom: 16px; display: block; opacity: 0.3;"></i>
                <p>You're all caught up. No new notifications.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}">
            <div class="notif-content">
                <div class="notif-title">${n.title}</div>
                <div class="notif-message">${n.message}</div>
                <div class="notif-time">${formatDate(n.createdAt)}</div>
            </div>
            <div class="notif-actions">
                ${!n.isRead ? `
                    <button class="btn btn-primary btn-sm" onclick="markNotificationRead('${n.id}')">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function updateNotificationBadge(notifications) {
    const badge = document.getElementById('notification-badge');
    const unreadCount = (notifications || []).filter(n => !n.isRead).length;
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'inline' : 'none';
}

async function loadNotificationBadge() {
    try {
        const result = await Api.getNotifications();
        if (result.success) {
            updateNotificationBadge(result.data);
        }
    } catch (error) {
        console.error('Badge error:', error);
    }
}

async function markNotificationRead(notificationId) {
    try {
        const result = await Api.markNotificationRead({ notificationId });
        if (result.success) {
            loadNotifications();
            loadNotificationBadge();
        }
    } catch (error) {
        console.error('Mark read error:', error);
        UI.showToast('Error marking notification as read', 'error');
    }
}

async function markAllRead() {
    UI.confirm('Mark All Read', 'Mark all notifications as read?', async () => {
        try {
            const result = await Api.getNotifications();
            if (result.success) {
                const notifications = result.data || [];
                for (const n of notifications) {
                    if (!n.isRead) {
                        await Api.markNotificationRead({ notificationId: n.id });
                    }
                }
                loadNotifications();
                loadNotificationBadge();
                UI.showToast('All notifications marked as read', 'success');
            }
        } catch (error) {
            console.error('Mark all read error:', error);
            UI.showToast('Error marking all as read', 'error');
        }
    });
}