import { NotificationService } from '../services/notification.service.js';
import { i18n } from '../services/i18n.js';

export class NotificationCenter {
    constructor() {
        this.container = null;
        this.notifications = new Map();
        this.init();
    }

    init() {
        this.createContainer();
        this.setupEventListeners();
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.className = 'notification-center';
        document.body.appendChild(this.container);
    }

    setupEventListeners() {
        window.addEventListener('kamila-notification', (event) => {
            this.showNotification(event.detail);
        });
    }

    showNotification({ title, message, type = 'info' }) {
        const id = Date.now();
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.setAttribute('role', 'alert');
        
        notification.innerHTML = `
            <div class="notification-header">
                <span class="notification-title">${title}</span>
                <button class="notification-close" aria-label="Zamknij">×</button>
            </div>
            <div class="notification-body">
                ${message}
            </div>
            <div class="notification-progress"></div>
        `;

        // Add to container
        this.container.appendChild(notification);
        this.notifications.set(id, notification);

        // Setup auto-dismiss
        const duration = type === 'error' ? 10000 : 5000;
        const progress = notification.querySelector('.notification-progress');
        
        progress.style.animation = `notification-progress ${duration}ms linear`;
        
        const timeout = setTimeout(() => {
            this.dismissNotification(id);
        }, duration);

        // Setup close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            clearTimeout(timeout);
            this.dismissNotification(id);
        });

        // Pause on hover
        notification.addEventListener('mouseenter', () => {
            progress.style.animationPlayState = 'paused';
            clearTimeout(timeout);
        });

        notification.addEventListener('mouseleave', () => {
            progress.style.animationPlayState = 'running';
            const remaining = duration * (1 - progress.style.width.replace('%', '') / 100);
            setTimeout(() => this.dismissNotification(id), remaining);
        });
    }

    dismissNotification(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        notification.classList.add('notification-dismiss');
        setTimeout(() => {
            notification.remove();
            this.notifications.delete(id);
        }, 300);
    }
} 