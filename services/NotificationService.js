import { logService } from './LogService.js';

/**
 * Service for handling notifications
 */
class NotificationService {
    constructor() {
        this.isInitialized = false;
        this.defaultOptions = {
            type: 'basic',
            iconUrl: '/assets/icons/icon-48.png',
            silent: false
        };
        logService.info('NotificationService constructed');
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            logService.info('Initializing NotificationService...');
            await this.requestPermission();
            this.isInitialized = true;
            logService.info('NotificationService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize NotificationService', error);
            throw error;
        }
    }

    async requestPermission() {
        try {
            logService.debug('Requesting notification permission...');
            const permission = await chrome.notifications.getPermissionLevel();
            
            if (permission !== 'granted') {
                logService.warn('Notification permission not granted');
            } else {
                logService.debug('Notification permission granted');
            }
        } catch (error) {
            logService.error('Failed to request notification permission', error);
            throw error;
        }
    }

    show(options) {
        try {
            logService.debug('Showing notification...', options);
            
            const notificationOptions = {
                ...this.defaultOptions,
                title: options.title || 'Notification',
                message: options.message || '',
                type: options.type || 'basic',
                priority: options.priority || 0
            };

            if (options.buttons) {
                notificationOptions.buttons = options.buttons.map(button => ({
                    title: button.title,
                    iconUrl: button.iconUrl
                }));
            }

            if (options.items) {
                notificationOptions.items = options.items;
            }

            if (options.progress) {
                notificationOptions.progress = options.progress;
            }

            chrome.notifications.create(options.id, notificationOptions, (notificationId) => {
                logService.debug('Notification shown', { notificationId });
                
                if (options.timeout) {
                    setTimeout(() => {
                        this.clear(notificationId);
                    }, options.timeout);
                }
            });
        } catch (error) {
            logService.error('Failed to show notification', error);
            throw error;
        }
    }

    async clear(notificationId) {
        try {
            logService.debug('Clearing notification...', { notificationId });
            await chrome.notifications.clear(notificationId);
            logService.debug('Notification cleared');
        } catch (error) {
            logService.error('Failed to clear notification', error);
            throw error;
        }
    }

    async clearAll() {
        try {
            logService.debug('Clearing all notifications...');
            const notifications = await chrome.notifications.getAll();
            await Promise.all(
                Object.keys(notifications).map(id => this.clear(id))
            );
            logService.debug('All notifications cleared');
        } catch (error) {
            logService.error('Failed to clear all notifications', error);
            throw error;
        }
    }

    onClicked(callback) {
        chrome.notifications.onClicked.addListener((notificationId) => {
            logService.debug('Notification clicked', { notificationId });
            callback(notificationId);
        });
    }

    onButtonClicked(callback) {
        chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
            logService.debug('Notification button clicked', { notificationId, buttonIndex });
            callback(notificationId, buttonIndex);
        });
    }

    onClosed(callback) {
        chrome.notifications.onClosed.addListener((notificationId, byUser) => {
            logService.debug('Notification closed', { notificationId, byUser });
            callback(notificationId, byUser);
        });
    }

    showError(message, options = {}) {
        this.show({
            type: 'basic',
            title: 'Error',
            message: message,
            iconUrl: '/assets/icons/icon-48.png',
            priority: 2,
            ...options
        });
        logService.error(message);
    }

    showWarning(message, options = {}) {
        this.show({
            type: 'basic',
            title: 'Warning',
            message: message,
            iconUrl: '/assets/icons/icon-48.png',
            priority: 1,
            ...options
        });
        logService.warn(message);
    }

    showSuccess(message, options = {}) {
        this.show({
            type: 'basic',
            title: 'Success',
            message: message,
            iconUrl: '/assets/icons/icon-48.png',
            priority: 0,
            ...options
        });
        logService.info(message);
    }
}

// Create and export singleton instance
export const notificationService = new NotificationService(); 