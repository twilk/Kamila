import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';
import { i18n } from './i18n.js';

export class NotificationManager extends BaseManager {
    constructor() {
        super();
        this.notifications = new Map();
        this.notificationIdCounter = 0;
        this.defaultDuration = 5000; // 5 seconds
        this.container = null;
    }

    async initialize() {
        try {
            await super.initialize();
            await this.initializeNotificationContainer();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    async initializeNotificationContainer() {
        try {
            // Create container if it doesn't exist
            let container = document.getElementById('notification-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'notification-container';
                document.body.appendChild(container);
            }
            this.container = container;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeNotificationContainer'
            });
        }
    }

    show(message, options = {}) {
        try {
            const id = `notification-${++this.notificationIdCounter}`;
            const {
                type = 'info',
                duration = this.defaultDuration,
                title = '',
                showChrome = false
            } = options;

            // Create notification element
            const notification = document.createElement('div');
            notification.id = id;
            notification.className = `notification notification-${type}`;
            notification.innerHTML = `
                <div class="notification-content">
                    ${title ? `<div class="notification-title">${title}</div>` : ''}
                    <div class="notification-message">${message}</div>
                </div>
                <button class="notification-close">&times;</button>
            `;

            // Add close handler
            const closeButton = notification.querySelector('.notification-close');
            closeButton.addEventListener('click', () => this.hide(id));

            // Store notification data
            this.notifications.set(id, {
                element: notification,
                timer: setTimeout(() => this.hide(id), duration)
            });

            // Add to container
            this.container.appendChild(notification);

            // Show Chrome notification if requested
            if (showChrome) {
                this.showChromeNotification(title || i18n.translate('notification'), message, type);
            }

            return id;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'show',
                message,
                options
            });
            return null;
        }
    }

    hide(id) {
        try {
            const notification = this.notifications.get(id);
            if (!notification) return;

            // Clear timeout
            if (notification.timer) {
                clearTimeout(notification.timer);
            }

            // Remove element
            notification.element.remove();
            this.notifications.delete(id);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'hide',
                id
            });
        }
    }

    hideAll() {
        try {
            // Create a copy of notification IDs to avoid modification during iteration
            const notificationIds = Array.from(this.notifications.keys());
            notificationIds.forEach(id => this.hide(id));
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'hideAll'
            });
        }
    }

    showChromeNotification(title, message, type = 'info') {
        try {
            const iconMap = {
                success: 'icon-success.png',
                error: 'icon-error.png',
                warning: 'icon-warning.png',
                info: 'icon-info.png'
            };

            chrome.notifications.create({
                type: 'basic',
                iconUrl: iconMap[type] || 'icon128.png',
                title,
                message,
                priority: type === 'error' ? 2 : 0
            });
        } catch (error) {
            this.handleError(error, ErrorType.CHROME_API, ErrorSeverity.WARNING, {
                method: 'showChromeNotification',
                title,
                message,
                type
            });
        }
    }

    // Convenience methods for different notification types
    success(message, options = {}) {
        return this.show(message, { ...options, type: 'success' });
    }

    error(message, options = {}) {
        return this.show(message, { ...options, type: 'error' });
    }

    warning(message, options = {}) {
        return this.show(message, { ...options, type: 'warning' });
    }

    info(message, options = {}) {
        return this.show(message, { ...options, type: 'info' });
    }

    dispose() {
        try {
            this.hideAll();
            this.notifications.clear();
            this.notificationIdCounter = 0;
            if (this.container) {
                this.container.remove();
                this.container = null;
            }
            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 