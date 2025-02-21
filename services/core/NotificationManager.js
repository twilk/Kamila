import { BaseManager } from './BaseManager.js';
import { LogLevel } from './LogLevel.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { API_CONFIG } from '../../config/api.js';

// Notification limits configuration
const NOTIFICATION_LIMITS = {
    PER_MINUTE: 10,
    PER_HOUR: 30,
    PER_DAY: 100,
    COOLDOWN_MS: 3000 // 3 seconds between notifications
};

// Default notification settings
const NOTIFICATION_DEFAULTS = {
    enabled: true,
    sound: true,
    desktop: true,
    limits: NOTIFICATION_LIMITS
};

class NotificationManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;
    
    /** @private */
    #eventManager = null;
    /** @private */
    #storageManager = null;
    /** @private */
    #languageManager = null;
    /** @private */
    #settings = NOTIFICATION_DEFAULTS;
    /** @private */
    #activeNotifications = new Map();
    /** @private */
    #notificationHistory = [];
    /** @private */
    #lastNotificationTime = 0;
    /** @private */
    #eventHandlers = new Map();

    static DEPENDENCIES = {
        required: ['event', 'storage'],
        optional: ['language']
    };

    constructor(registry) {
        if (NotificationManager.#instance) {
            return NotificationManager.#instance;
        }
        super(registry, 'NotificationManager');
        NotificationManager.#instance = this;
        NotificationManager._registry = registry;
        
        // Add dependencies
        this.addDependency('event');
        this.addDependency('storage');
        this.addDependency('language');
    }

    /**
     * Get singleton instance
     * @returns {NotificationManager}
     */
    static getInstance() {
        if (!NotificationManager.#instance && NotificationManager._registry) {
            NotificationManager.#instance = new NotificationManager(NotificationManager._registry);
        }
        return NotificationManager.#instance;
    }

    /**
     * Set registry for all instances
     * @param {ManagerRegistry} registry Manager registry
     */
    static setRegistry(registry) {
        NotificationManager._registry = registry;
    }

    /**
     * Initialize notification manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing notification manager...');
            
            // Get required dependencies
            const [eventManager, storageManager, languageManager] = await Promise.all([
                this.getDependency('event'),
                this.getDependency('storage'),
                this.getDependency('language')
            ]);

            // Validate required dependencies
            if (!eventManager?.isInitialized()) {
                throw new Error('EventManager must be initialized');
            }

            if (!storageManager?.isInitialized()) {
                throw new Error('StorageManager must be initialized');
            }

            // Store dependencies
            this.#eventManager = eventManager;
            this.#storageManager = storageManager;
            this.#languageManager = languageManager;
            
            // Load notification history from storage
            const data = await storageManager.get('notifications');
            if (data) {
                this.#notificationHistory = data.history || [];
                this.#lastNotificationTime = data.lastTime || 0;
            }

            // Clean up old notifications
            this.#cleanupHistory();

            // Setup event listeners
            await this.#setupEventListeners();

            // Setup notification click handler
            this.#setupNotificationClickHandler();

            this.log(LogLevel.SUCCESS, '✅ Notification manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: '_initialize'
            });
            return false;
        }
    }

    /**
     * Set up event listeners
     * @private
     */
    #setupEventListeners = async () => {
        try {
            const eventManager = await this.getDependency('event');
            
            // Listen for order status changes
            await eventManager.on('order:statusChanged', async (event) => {
                try {
                    const { order, newStatus } = event;
                    await this.createNotification(order, newStatus);
                } catch (error) {
                    this.handleError(error, ErrorType.EVENT_HANDLER, ErrorSeverity.MEDIUM, {
                        method: '#setupEventListeners',
                        event: 'order:statusChanged'
                    });
                }
            });

            // Listen for new orders
            await eventManager.on('order:new', async (event) => {
                try {
                    const { order } = event;
                    await this.createNotification(order, 'NEW');
                } catch (error) {
                    this.handleError(error, ErrorType.EVENT_HANDLER, ErrorSeverity.MEDIUM, {
                        method: '#setupEventListeners',
                        event: 'order:new'
                    });
                }
            });

            // Listen for order updates
            await eventManager.on('order:updated', async (event) => {
                try {
                    const { order, changes } = event;
                    if (changes.status) {
                        await this.createNotification(order, changes.status);
                    }
                } catch (error) {
                    this.handleError(error, ErrorType.EVENT_HANDLER, ErrorSeverity.MEDIUM, {
                        method: '#setupEventListeners',
                        event: 'order:updated'
                    });
                }
            });
            
            this.log(LogLevel.SUCCESS, '✅ Notification event listeners initialized');
        } catch (error) {
            this.handleError(error, ErrorType.EVENT_LISTENER, ErrorSeverity.HIGH);
            throw error;
        }
    };

    /**
     * Set up notification click handler
     * @private
     */
    #setupNotificationClickHandler = () => {
        chrome.notifications.onClicked.addListener(async (notificationId) => {
            try {
                if (notificationId.startsWith('order-')) {
                    const orderId = notificationId.replace('order-', '');
                    const orderUrl = `${API_CONFIG.DARWINA.BASE_URL}/orders/${orderId}`;
                    
                    // Open order in new tab
                    chrome.tabs.create({ url: orderUrl });
                    
                    // Clear the notification
                    chrome.notifications.clear(notificationId);
                }
            } catch (error) {
                this.handleError(error, ErrorType.NOTIFICATION, ErrorSeverity.LOW, {
                    method: '#setupNotificationClickHandler',
                    notificationId
                });
            }
        });
    };

    /**
     * Clean up notification history
     * @private
     */
    #cleanupHistory = () => {
        const now = Date.now();
        this.#notificationHistory = this.#notificationHistory.filter(
            time => now - time < 24 * 60 * 60 * 1000
        );
    };

    /**
     * Check if notification can be shown
     * @returns {Promise<boolean>}
     */
    async canShowNotification() {
        const now = Date.now();
        
        // Clean up old entries
        this.#cleanupHistory();

        // Check cooldown
        if (now - this.#lastNotificationTime < NOTIFICATION_LIMITS.COOLDOWN_MS) {
            this.log(LogLevel.DEBUG, '⏳ Notification cooldown active');
            return false;
        }

        // Get user settings
        const { notificationSettings } = await chrome.storage.local.get('notificationSettings');
        const userLimits = notificationSettings?.limits || NOTIFICATION_LIMITS;

        // Check limits
        const lastMinute = this.#notificationHistory.filter(
            time => now - time < 60 * 1000
        ).length;
        if (lastMinute >= userLimits.PER_MINUTE) {
            this.log(LogLevel.WARN, '⚠️ Per minute notification limit exceeded');
            return false;
        }

        const lastHour = this.#notificationHistory.filter(
            time => now - time < 60 * 60 * 1000
        ).length;
        if (lastHour >= userLimits.PER_HOUR) {
            this.log(LogLevel.WARN, '⚠️ Per hour notification limit exceeded');
            return false;
        }

        const lastDay = this.#notificationHistory.length;
        if (lastDay >= userLimits.PER_DAY) {
            this.log(LogLevel.WARN, '⚠️ Daily notification limit exceeded');
            return false;
        }

        return true;
    }

    /**
     * Track shown notification
     * @returns {Promise<void>}
     */
    async trackNotification() {
        try {
            const now = Date.now();
            this.#notificationHistory.push(now);
            this.#lastNotificationTime = now;
            
            // Save history for persistence
            await this.#storageManager.set('notifications', {
                history: this.#notificationHistory,
                lastTime: this.#lastNotificationTime
            });

            // Emit notification created event
            this.#eventManager.emit('notification:created', {
                timestamp: now,
                stats: this.getStats()
            });
        } catch (error) {
            this.handleError(error, ErrorType.NOTIFICATION, ErrorSeverity.LOW, {
                method: 'trackNotification'
            });
        }
    }

    /**
     * Get notification stats
     * @returns {Object}
     */
    getStats() {
        const now = Date.now();
        return {
            lastMinute: this.#notificationHistory.filter(time => now - time < 60 * 1000).length,
            lastHour: this.#notificationHistory.filter(time => now - time < 60 * 60 * 1000).length,
            lastDay: this.#notificationHistory.length,
            timeSinceLastNotification: now - this.#lastNotificationTime
        };
    }

    /**
     * Create a notification
     * @param {Object} order Order object
     * @param {string} status Order status
     * @returns {Promise<void>}
     */
    async createNotification(order, status) {
        try {
            const languageManager = this.getDependency('language');
            
            // Ensure translations are loaded
            await languageManager.waitForTranslations();
            
            // Check limits before showing notification
            const canShow = await this.canShowNotification();
            if (!canShow) {
                this.log(LogLevel.WARN, '⚠️ Notification limit reached, skipping');
                return;
            }

            const orderUrl = `${API_CONFIG.DARWINA.BASE_URL}/orders/${order.order_id}`;
            const notificationId = `order-${order.order_id}`;
            
            const title = languageManager.translate('statusUpdate');
            const message = languageManager.translate('statusChangeFormat', {
                status,
                previous: order.status_name,
                current: status
            });
            
            chrome.notifications.create(notificationId, {
                type: 'basic',
                iconUrl: 'icon128.png',
                title: title,
                message: message,
                buttons: [
                    {
                        title: languageManager.translate('viewOrder')
                    }
                ],
                requireInteraction: true,
                silent: false
            });

            // Track shown notification
            await this.trackNotification();
            
            this.log(LogLevel.SUCCESS, '✅ Notification created', {
                orderId: order.order_id,
                stats: this.getStats()
            });

            // Emit notification shown event
            const eventManager = this.getDependency('event');
            eventManager.emit('notification:shown', {
                order,
                status,
                timestamp: Date.now()
            });
        } catch (error) {
            this.handleError(error, ErrorType.NOTIFICATION, ErrorSeverity.MEDIUM, {
                method: 'createNotification',
                orderId: order?.order_id,
                status
            });
        }
    }

    /**
     * Show update notification
     * @param {string} version New version
     * @returns {Promise<void>}
     */
    async showUpdateNotification(version) {
        try {
            const languageManager = this.getDependency('language');
            const notificationId = `update-${version}`;
            
            chrome.notifications.create(notificationId, {
                type: 'basic',
                iconUrl: 'icon128.png',
                title: languageManager.translate('updateAvailable'),
                message: languageManager.translate('updateAvailableMessage', { version }),
                requireInteraction: true,
                silent: false
            });

            await this.trackNotification();
        } catch (error) {
            this.handleError(error, ErrorType.NOTIFICATION, ErrorSeverity.MEDIUM, {
                method: 'showUpdateNotification',
                version
            });
        }
    }

    /**
     * Show update start notification
     * @returns {Promise<void>}
     */
    async showUpdateStartNotification() {
        try {
            const languageManager = this.getDependency('language');
            const notificationId = 'update-start';
            
            chrome.notifications.create(notificationId, {
                type: 'basic',
                iconUrl: 'icon128.png',
                title: languageManager.translate('updateStarted'),
                message: languageManager.translate('updateStartedMessage'),
                requireInteraction: false,
                silent: false
            });

            await this.trackNotification();
        } catch (error) {
            this.handleError(error, ErrorType.NOTIFICATION, ErrorSeverity.MEDIUM, {
                method: 'showUpdateStartNotification'
            });
        }
    }

    /**
     * Show update complete notification
     * @returns {Promise<void>}
     */
    async showUpdateCompleteNotification() {
        try {
            const languageManager = this.getDependency('language');
            const notificationId = 'update-complete';
            
            chrome.notifications.create(notificationId, {
                type: 'basic',
                iconUrl: 'icon128.png',
                title: languageManager.translate('updateComplete'),
                message: languageManager.translate('updateCompleteMessage'),
                requireInteraction: false,
                silent: false
            });

            await this.trackNotification();
        } catch (error) {
            this.handleError(error, ErrorType.NOTIFICATION, ErrorSeverity.MEDIUM, {
                method: 'showUpdateCompleteNotification'
            });
        }
    }

    /**
     * Show update error notification
     * @param {Error} error Error object
     * @returns {Promise<void>}
     */
    async showUpdateErrorNotification(error) {
        try {
            const languageManager = this.getDependency('language');
            const notificationId = 'update-error';
            
            chrome.notifications.create(notificationId, {
                type: 'basic',
                iconUrl: 'icon128.png',
                title: languageManager.translate('updateError'),
                message: languageManager.translate('updateErrorMessage', { error: error.message }),
                requireInteraction: true,
                silent: false
            });

            await this.trackNotification();
        } catch (err) {
            this.handleError(err, ErrorType.NOTIFICATION, ErrorSeverity.MEDIUM, {
                method: 'showUpdateErrorNotification',
                originalError: error
            });
        }
    }
}

// Export both class and instance
export { NotificationManager };
export const notificationManager = NotificationManager.getInstance();
