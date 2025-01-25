import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { i18n } from '../i18n.js';

// Konfiguracja limitów powiadomień
const NOTIFICATION_LIMITS = {
    PER_MINUTE: 10,
    PER_HOUR: 30,
    PER_DAY: 100,
    COOLDOWN_MS: 3000 // 3 sekundy między powiadomieniami
};

export class NotificationManager extends BaseManager {
    static _instance = null;

    static getInstance() {
        if (!NotificationManager._instance) {
            NotificationManager._instance = new NotificationManager();
        }
        return NotificationManager._instance;
    }

    constructor() {
        if (NotificationManager._instance) {
            throw new Error('NotificationManager is a singleton. Use NotificationManager.getInstance() instead.');
        }
        super('NotificationManager');
        this.notificationHistory = [];
        this.lastNotificationTime = 0;
        this.notifications = new Map();
        this.notificationIdCounter = 0;
        this.defaultDuration = 5000; // 5 seconds
        this.container = null;
        NotificationManager._instance = this;
    }

    async initialize() {
        try {
            // Wczytaj historię z storage
            const data = await chrome.storage.local.get('notifications');
            
            if (data.notifications) {
                this.notificationHistory = data.notifications.history || [];
                this.lastNotificationTime = data.notifications.lastTime || 0;
            }

            this.log('debug', '✅ NotificationManager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.NOTIFICATION, ErrorSeverity.LOW, {
                method: 'initialize'
            });
            return false;
        }
    }

    async canShowNotification() {
        try {
            const now = Date.now();
            
            // Usuń stare wpisy (starsze niż 24h)
            this.notificationHistory = this.notificationHistory.filter(
                time => now - time < 24 * 60 * 60 * 1000
            );

            // Sprawdź cooldown
            if (now - this.lastNotificationTime < NOTIFICATION_LIMITS.COOLDOWN_MS) {
                this.log('debug', '🕒 Cooldown aktywny, pomijam powiadomienie');
                return false;
            }

            // Sprawdź limity
            const lastMinute = this.notificationHistory.filter(
                time => now - time < 60 * 1000
            ).length;
            if (lastMinute >= NOTIFICATION_LIMITS.PER_MINUTE) {
                this.log('debug', '⚠️ Przekroczono limit powiadomień na minutę');
                return false;
            }

            const lastHour = this.notificationHistory.filter(
                time => now - time < 60 * 60 * 1000
            ).length;
            if (lastHour >= NOTIFICATION_LIMITS.PER_HOUR) {
                this.log('debug', '⚠️ Przekroczono limit powiadomień na godzinę');
                return false;
            }

            const lastDay = this.notificationHistory.length;
            if (lastDay >= NOTIFICATION_LIMITS.PER_DAY) {
                this.log('debug', '⚠️ Przekroczono dzienny limit powiadomień');
                return false;
            }

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.NOTIFICATION, ErrorSeverity.LOW, {
                method: 'canShowNotification'
            });
            return false;
        }
    }

    async trackNotification() {
        try {
            const now = Date.now();
            this.notificationHistory.push(now);
            this.lastNotificationTime = now;
            
            // Zapisz historię do storage dla persystencji
            await chrome.storage.local.set({
                notifications: {
                    history: this.notificationHistory,
                    lastTime: this.lastNotificationTime
                }
            });

            this.log('debug', '✅ Notification tracked', {
                history: this.notificationHistory.length,
                lastTime: this.lastNotificationTime
            });
        } catch (error) {
            this.handleError(error, ErrorType.NOTIFICATION, ErrorSeverity.LOW, {
                method: 'trackNotification'
            });
        }
    }

    async showStatusNotification(status, oldCount, newCount) {
        try {
            // Check if notifications are supported
            if (!('notifications' in chrome)) {
                this.log('warn', '⚠️ Notifications not supported');
                return;
            }

            // Check if we can show a notification
            if (!await this.canShowNotification()) {
                this.log('debug', '🔕 Notification skipped due to limits', this.getStats());
                return;
            }

            // Get translated status name and description
            const statusName = i18n.translate(`leadStatuses.${status}`);
            const statusDesc = i18n.translate(`tooltips.leadStatuses.${status}`);

            // Create notification with unique ID
            const notificationId = `status-${status}-${Date.now()}`;
            await chrome.notifications.create(notificationId, {
                type: 'basic',
                iconUrl: 'icon128.png',
                title: i18n.translate('statusUpdate'),
                message: i18n.translate('statusChangeFormat', {
                    status: statusName,
                    previous: oldCount,
                    current: newCount
                }),
                contextMessage: statusDesc,
                priority: 1,
                requireInteraction: false,
                silent: false
            });

            // Track this notification
            await this.trackNotification();

            this.log('debug', '🔔 Notification shown', {
                id: notificationId,
                status,
                oldCount,
                newCount,
                limits: this.getStats()
            });

        } catch (error) {
            this.handleError(error, ErrorType.NOTIFICATION, ErrorSeverity.LOW, {
                method: 'showStatusNotification',
                status,
                oldCount,
                newCount
            });
        }
    }

    getStats() {
        const now = Date.now();
        const stats = {
            lastMinute: this.notificationHistory.filter(time => now - time < 60 * 1000).length,
            lastHour: this.notificationHistory.filter(time => now - time < 60 * 60 * 1000).length,
            lastDay: this.notificationHistory.length,
            timeSinceLastNotification: now - this.lastNotificationTime,
            limits: {
                perMinute: NOTIFICATION_LIMITS.PER_MINUTE,
                perHour: NOTIFICATION_LIMITS.PER_HOUR,
                perDay: NOTIFICATION_LIMITS.PER_DAY,
                cooldownMs: NOTIFICATION_LIMITS.COOLDOWN_MS
            }
        };

        this.log('debug', '📊 Notification stats', stats);
        return stats;
    }
}

// Export singleton instance
export const notificationManager = NotificationManager.getInstance(); 