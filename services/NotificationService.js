import { logService } from './LogService.js';

export class NotificationService {
    constructor() {
        this.initialized = false;
        logService.info('NotificationService constructed');
    }

    async initialize() {
        if (this.initialized) return;

        try {
            logService.info('Initializing NotificationService...');
            
            // Request notification permissions if needed
            if (chrome.notifications) {
                chrome.notifications.getPermissionLevel((level) => {
                    if (level !== 'granted') {
                        logService.warn('Notifications not granted');
                    }
                });
            }
            
            this.initialized = true;
            logService.info('NotificationService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize NotificationService:', error);
            throw error;
        }
    }

    show(options) {
        try {
            const notificationOptions = {
                type: options.type || 'basic',
                iconUrl: options.iconUrl || chrome.runtime.getURL('assets/icons/icon-48.png'),
                title: options.title || 'Kamila',
                message: options.message,
                priority: options.priority || 0
            };

            // Validate notification type
            const validTypes = ['basic', 'image', 'list', 'progress'];
            if (!validTypes.includes(notificationOptions.type)) {
                notificationOptions.type = 'basic';
            }

            // Ensure we have a valid icon
            if (!notificationOptions.iconUrl.startsWith('chrome-extension://')) {
                notificationOptions.iconUrl = chrome.runtime.getURL('assets/icons/icon-48.png');
            }

            chrome.notifications.create(null, notificationOptions, (notificationId) => {
                if (chrome.runtime.lastError) {
                    logService.error('Failed to show notification:', {
                        error: chrome.runtime.lastError,
                        options: notificationOptions
                    });
                    // Try without icon if it failed
                    if (chrome.runtime.lastError.message?.includes('image')) {
                        delete notificationOptions.iconUrl;
                        chrome.notifications.create(null, notificationOptions, (retryId) => {
                            if (chrome.runtime.lastError) {
                                logService.error('Failed to show notification even without icon:', chrome.runtime.lastError);
                            } else {
                                logService.debug('Notification shown without icon:', retryId);
                            }
                        });
                    }
                } else {
                    logService.debug('Notification shown:', notificationId);
                }
            });
        } catch (error) {
            logService.error('Failed to show notification:', error);
        }
    }

    showSuccess(message, title = 'Sukces') {
        this.show({
            type: 'basic',
            title,
            message,
            priority: 0
        });
    }

    showError(message, title = 'Błąd') {
        this.show({
            type: 'basic',
            title,
            message,
            priority: 2
        });
    }

    showWarning(message, title = 'Ostrzeżenie') {
        this.show({
            type: 'basic',
            title,
            message,
            priority: 1
        });
    }

    showInfo(message, title = 'Informacja') {
        this.show({
            type: 'basic',
            title,
            message,
            priority: 0
        });
    }

    cleanup() {
        this.initialized = false;
    }
}

export const notificationService = new NotificationService(); 