import { performanceMonitor } from './performance.js';
import { i18n } from './i18n.js';

export class NotificationService {
    static PERMISSION_KEY = 'notification_permission';
    static SETTINGS_KEY = 'notification_settings';

    static async init() {
        performanceMonitor.startMeasure('notification-init');
        
        try {
            // Sprawdź zapisane ustawienia
            const settings = await this.getSettings();
            
            // Sprawdź uprawnienia
            if (settings.enabled && !settings.permissionChecked) {
                await this.requestPermission();
            }
            
            performanceMonitor.endMeasure('notification-init');
        } catch (error) {
            console.error('Notification init error:', error);
            performanceMonitor.endMeasure('notification-init');
        }
    }

    static async notify(options) {
        const settings = await this.getSettings();
        if (!settings.enabled) return false;

        const {
            title,
            message,
            type = 'info',
            priority = 'normal',
            data = {}
        } = options;

        try {
            // Browser notification
            if (settings.browserNotifications) {
                await this.showBrowserNotification(title, message, type);
            }

            // In-app notification
            if (settings.inAppNotifications) {
                this.showInAppNotification(title, message, type);
            }

            // Log notification
            if (settings.logNotifications) {
                await this.logNotification({
                    title,
                    message,
                    type,
                    priority,
                    timestamp: Date.now(),
                    data
                });
            }

            return true;
        } catch (error) {
            console.error('Notification error:', error);
            return false;
        }
    }

    static async showBrowserNotification(title, message, type) {
        if (Notification.permission !== 'granted') return;

        const icon = this.getIconForType(type);
        
        return new Notification(title, {
            body: message,
            icon,
            tag: `kamila-${type}-${Date.now()}`,
            requireInteraction: type === 'error'
        });
    }

    static showInAppNotification(title, message, type) {
        const event = new CustomEvent('kamila-notification', {
            detail: { title, message, type }
        });
        window.dispatchEvent(event);
    }

    static async requestPermission() {
        try {
            const permission = await Notification.requestPermission();
            await this.updateSettings({ permissionChecked: true });
            return permission === 'granted';
        } catch (error) {
            console.error('Permission request error:', error);
            return false;
        }
    }

    static async getSettings() {
        const defaults = {
            enabled: true,
            browserNotifications: true,
            inAppNotifications: true,
            logNotifications: true,
            permissionChecked: false,
            mutedTypes: []
        };

        try {
            const result = await chrome.storage.local.get(this.SETTINGS_KEY);
            return { ...defaults, ...result[this.SETTINGS_KEY] };
        } catch (error) {
            console.error('Error getting notification settings:', error);
            return defaults;
        }
    }

    static async updateSettings(settings) {
        try {
            const current = await this.getSettings();
            const updated = { ...current, ...settings };
            await chrome.storage.local.set({ [this.SETTINGS_KEY]: updated });
            return true;
        } catch (error) {
            console.error('Error updating notification settings:', error);
            return false;
        }
    }

    static getIconForType(type) {
        const icons = {
            info: 'icons/info.png',
            success: 'icons/success.png',
            warning: 'icons/warning.png',
            error: 'icons/error.png'
        };
        return icons[type] || icons.info;
    }

    static async logNotification(notification) {
        try {
            const key = `notifications_${notification.type}`;
            const result = await chrome.storage.local.get(key);
            const logs = result[key] || [];
            
            logs.unshift(notification);
            
            // Keep only last 100 notifications of each type
            if (logs.length > 100) logs.length = 100;
            
            await chrome.storage.local.set({ [key]: logs });
            return true;
        } catch (error) {
            console.error('Error logging notification:', error);
            return false;
        }
    }
} 