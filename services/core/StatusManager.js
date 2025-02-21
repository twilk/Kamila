import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity, LogLevel } from '../constants.js';

const STATUS_CONFIG = {
    UPDATE_INTERVAL: 30 * 1000, // 30 seconds
    NOTIFICATION_COOLDOWN: 5 * 60 * 1000, // 5 minutes
    MAX_NOTIFICATIONS: 5
};

/**
 * @typedef {Object} OrderCounts
 * @property {number} '1' - New orders
 * @property {number} '2' - Confirmed orders
 * @property {number} '3' - Accepted orders
 * @property {number} 'READY' - Ready orders
 * @property {number} 'OVERDUE' - Overdue orders
 */

/**
 * @typedef {Object} StatusMapType
 * @property {string} submitted - Status for new orders
 * @property {string} confirmed - Status for confirmed orders
 * @property {string} accepted - Status for accepted orders
 * @property {string} ready - Status for ready orders
 * @property {string} overdue - Status for overdue orders
 */

/** @type {StatusMapType} */
export const STATUS_MAP = {
    submitted: '1',
    confirmed: '2',
    accepted: '3',
    ready: 'READY',
    overdue: 'OVERDUE'
};

// Development mode detection
const isDevelopment = () => {
    try {
        return !chrome.runtime.getManifest().update_url;
    } catch (e) {
        return false;
    }
};

/**
 * Manager for handling application status and notifications
 * @extends BaseManager
 */
class StatusManager extends BaseManager {
    static #instance = null;
    static _registry = null;
    #services = {
        api: false,
        auth: false,
        orders: false,
        cache: false
    };
    #updateInterval = null;
    #pendingUIUpdates = new Set();
    #baseUrl = 'https://darwina.pl/api';
    #dataManager = null;
    #currentCounts = null;
    #uiUpdateTimeout = null;
    #uiUpdateDelay = 100; // ms
    #status = {
        online: true,
        initialized: false,
        error: null,
        orderCounts: {
            '1': 0,
            '2': 0,
            '3': 0,
            'READY': 0,
            'OVERDUE': 0
        },
        lastUpdate: null
    };
    #lastNotification = null;
    #notificationCount = 0;
    #previousCounts = null;

    constructor(registry) {
        if (StatusManager.#instance) {
            return StatusManager.#instance;
        }
        super(registry, 'StatusManager');
        StatusManager.#instance = this;
        StatusManager._registry = registry;
        
        this.addDependency('event');
        this.addDependency('store');
    }

    static getInstance() {
        if (!StatusManager.#instance && StatusManager._registry) {
            StatusManager.#instance = new StatusManager(StatusManager._registry);
        }
        return StatusManager.#instance;
    }

    static setRegistry(registry) {
        StatusManager._registry = registry;
    }

    /**
     * Initialize status manager
     * @protected
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing status manager...');
            
            // Add dependencies
            this.addDependency('ui');
            this.addDependency('event');
            
            // Get dependencies
            const eventManager = await this.getDependency('event');
            
            if (!eventManager?.isReady()) {
                throw new Error('EventManager must be ready');
            }

            // Setup event listeners first
            await eventManager.on('ui:ready', () => this.#processPendingUIUpdates());
            await eventManager.on('service:status', ({ service, status }) => this.updateStatus(service, status));
            await eventManager.on('store:change', this.#handleStoreChange.bind(this));
            
            // Start with initial status check
            await this.checkAllServices();
            
            // Initialize data manager connection after basic setup
            const dataManager = await this.getDependency('data');
            
            // Setup periodic checks
            this.#startPeriodicChecks();

            // Setup online/offline listeners
            window.addEventListener('online', () => this.#handleOnlineStatus(true));
            window.addEventListener('offline', () => this.#handleOnlineStatus(false));

            // Start status updates
            this.#startStatusUpdates();

            // Set initial online status
            this.#status.online = navigator.onLine;
            this.#status.initialized = true;

            this.log(LogLevel.SUCCESS, '✨ Status manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: '_initialize'
            });
            return false;
        }
    }

    /**
     * Handle store change event
     * @private
     */
    async #handleStoreChange({ storeId }) {
        try {
            // Only attempt data operations if DataManager is available
            if (this.#dataManager?.isInitialized()) {
                await this.#dataManager.loadAndUpdateData(true);
            }
        } catch (error) {
            this.handleError(error, ErrorType.EVENT, ErrorSeverity.LOW, {
                method: '#handleStoreChange',
                storeId
            });
        }
    }

    /**
     * Update service status
     * @param {string} service Service name
     * @param {boolean} status Service status
     */
    updateStatus(service, status) {
        if (this.#services[service] === undefined) {
            this.log(LogLevel.WARNING, `⚠️ Unknown service: ${service}`);
            return;
        }

        const oldStatus = this.#services[service];
        this.#services[service] = status;

        // If status changed, emit event
        if (oldStatus !== status) {
            managers.eventManager.emit('status:change', {
                service,
                status,
                previous: oldStatus
            });
        }

        // Queue UI update
        this.#queueUIUpdate(service);
    }

    /**
     * Queue UI update for when UIManager is ready
     * @private
     * @param {string} service Service name
     */
    #queueUIUpdate(service) {
        this.#pendingUIUpdates.add(service);
        this.#tryProcessUIUpdates();
    }

    /**
     * Try to process pending UI updates
     * @private
     */
    async #tryProcessUIUpdates() {
        try {
            const ui = managers.uiManager;
            if (ui?.isInitialized()) {
                await this.#processPendingUIUpdates();
            }
        } catch (error) {
            // UIManager not ready yet, updates will be processed when it emits 'ui:ready'
            this.log(LogLevel.DEBUG, '⚠️ UIManager not initialized yet');
        }
    }

    /**
     * Process pending UI updates
     * @private
     * @returns {Promise<void>}
     */
    async #processPendingUIUpdates() {
        try {
            const uiManager = managers.uiManager;
            if (!uiManager?.isInitialized()) {
                return;
            }

            const updates = Array.from(this.#pendingUIUpdates);
            this.#pendingUIUpdates.clear();

            for (const update of updates) {
                try {
                    const element = document.getElementById(update.elementId);
                    if (!element) continue;

                    // Update element based on type
                    switch (update.type) {
                        case 'count':
                            element.textContent = update.value;
                            element.classList.toggle('count-zero', update.value === 0);
                            element.classList.add('count-updated');
                            setTimeout(() => element.classList.remove('count-updated'), 1000);
                            break;
                        default:
                            this.log(LogLevel.WARNING, `Unknown update type: ${update.type}`);
                    }
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                        method: '_processPendingUIUpdates',
                        update
                    });
                }
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: '_processPendingUIUpdates'
            });
        }
    }

    /**
     * Start periodic status checks
     * @private
     */
    #startPeriodicChecks() {
        if (this.#updateInterval) {
            clearInterval(this.#updateInterval);
        }

        this.#updateInterval = setInterval(() => {
            this.checkAllServices().catch(error => {
                this.handleError(error, ErrorType.SERVICE, ErrorSeverity.LOW, {
                    method: '_startPeriodicChecks'
                });
            });
        }, 60000); // Check every minute
    }

    /**
     * Check all service statuses
     * @returns {Promise<void>}
     */
    async checkAllServices() {
        try {
            const checks = await Promise.allSettled([
                this.#checkApiStatus(),
                this.#checkAuthStatus(),
                this.#checkOrdersStatus(),
                this.#checkCacheStatus()
            ]);

            checks.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const services = ['api', 'auth', 'orders', 'cache'];
                    this.handleError(result.reason, ErrorType.SERVICE, ErrorSeverity.LOW, {
                        method: 'checkAllServices',
                        service: services[index]
                    });
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.SERVICE, ErrorSeverity.MEDIUM, {
                method: 'checkAllServices'
            });
        }
    }

    /**
     * Clean up resources
     * @protected
     */
    async _dispose() {
        if (this.#updateInterval) {
            clearInterval(this.#updateInterval);
            this.#updateInterval = null;
        }
        this.#pendingUIUpdates.clear();
        await super._dispose();
        window.removeEventListener('online', this.#handleOnlineStatus);
        window.removeEventListener('offline', this.#handleOnlineStatus);
        this.#status = {
            online: false,
            initialized: false,
            error: null,
            orderCounts: {
                '1': 0,
                '2': 0,
                '3': 0,
                'READY': 0,
                'OVERDUE': 0
            },
            lastUpdate: null
        };
    }

    // Private service check methods...
    async #checkApiStatus() {
        try {
            if (isDevelopment()) {
                return true;
            }

            const response = await fetch(`${this.#baseUrl}/api/auth/access_token`, {
                method: 'HEAD',
                headers: { 'Content-Type': 'application/json' }
            });
            return response.ok;
        } catch (error) {
            this.handleError(error, ErrorType.SERVICE, ErrorSeverity.LOW, {
                method: '_checkApiStatus'
            });
            return false;
        }
    }

    async #checkAuthStatus() {
        try {
            const token = await chrome.storage.local.get('token');
            return !!token?.token;
        } catch (error) {
            this.handleError(error, ErrorType.SERVICE, ErrorSeverity.LOW, {
                method: '_checkAuthStatus'
            });
            return false;
        }
    }

    async #checkOrdersStatus() {
        try {
            const lastUpdate = await chrome.storage.local.get('lastOrdersUpdate');
            if (!lastUpdate?.lastOrdersUpdate) return false;
            
            // Check if orders were updated in last 5 minutes
            const timeSinceUpdate = Date.now() - lastUpdate.lastOrdersUpdate;
            return timeSinceUpdate < 300000; // 5 minutes
        } catch (error) {
            this.handleError(error, ErrorType.SERVICE, ErrorSeverity.LOW, {
                method: '_checkOrdersStatus'
            });
            return false;
        }
    }

    async #checkCacheStatus() {
        try {
            const cache = await chrome.storage.local.get(['cacheStatus', 'cacheTimestamp']);
            if (!cache?.cacheStatus || !cache?.cacheTimestamp) return false;

            // Check if cache is not older than 1 hour
            const cacheAge = Date.now() - cache.cacheTimestamp;
            return cacheAge < 3600000; // 1 hour
        } catch (error) {
            this.handleError(error, ErrorType.SERVICE, ErrorSeverity.LOW, {
                method: '_checkCacheStatus'
            });
            return false;
        }
    }

    /**
     * Map status to internal status code with validation
     * @param {string} status - Status to map
     * @param {string} [orderId] - Optional order ID for logging
     * @returns {string|null} Internal status code or null if invalid
     */
    static mapStatus(status) {
        try {
            if (!status) {
                throw new Error('Status cannot be empty');
            }

            const normalized = status.toLowerCase().trim();
            const mapped = STATUS_MAP[normalized];

            if (!mapped) {
                throw new Error(`Invalid status: ${status}`);
            }

            return mapped;
        } catch (error) {
            this.handleError(error, ErrorType.VALIDATION, ErrorSeverity.LOW, {
                method: 'mapStatus',
                status,
                orderId
            });
            return null;
        }
    }

    /**
     * Update order counts and notify if needed
     * @param {OrderCounts} counts New order counts
     */
    async updateOrderCounts(counts) {
        try {
            // Store previous counts for comparison
            this.#previousCounts = { ...this.#status.orderCounts };

            // Update counts
            this.#status.orderCounts = counts;
            this.#status.lastUpdate = Date.now();

            // Check for significant changes
            await this.#checkForSignificantChanges();

            // Emit status update event
            const event = await this.getDependency('event');
            await event.emit('status:updated', {
                type: 'orders',
                counts,
                timestamp: this.#status.lastUpdate
            });
        } catch (error) {
            this.handleError(error, ErrorType.STATUS_UPDATE, ErrorSeverity.MEDIUM);
        }
    }

    /**
     * Check for significant changes in order counts
     * @private
     */
    async #checkForSignificantChanges() {
        if (!this.#previousCounts) return;

        const notification = await this.getDependency('notification');
        const now = Date.now();

        // Check notification cooldown
        if (this.#lastNotification && 
            now - this.#lastNotification < STATUS_CONFIG.NOTIFICATION_COOLDOWN) {
            return;
        }

        // Check notification limit
        if (this.#notificationCount >= STATUS_CONFIG.MAX_NOTIFICATIONS) {
            return;
        }

        // Check for new orders
        const newOrders = this.#status.orderCounts['1'] - this.#previousCounts['1'];
        if (newOrders > 0) {
            await notification.show(
                'New Orders',
                `You have ${newOrders} new order${newOrders > 1 ? 's' : ''}!`,
                { type: 'info' }
            );
            this.#lastNotification = now;
            this.#notificationCount++;
        }

        // Check for overdue orders
        const overdueOrders = this.#status.orderCounts['OVERDUE'] - this.#previousCounts['OVERDUE'];
        if (overdueOrders > 0) {
            await notification.show(
                'Overdue Orders',
                `You have ${overdueOrders} new overdue order${overdueOrders > 1 ? 's' : ''}!`,
                { type: 'warning' }
            );
            this.#lastNotification = now;
            this.#notificationCount++;
        }

        // Reset notification count periodically
        if (now - this.#lastNotification > STATUS_CONFIG.NOTIFICATION_COOLDOWN) {
            this.#notificationCount = 0;
        }
    }

    /**
     * Get current status
     * @returns {Object} Current status
     */
    getStatus() {
        return {
            ...this.#status,
            uptime: this.getMetrics().uptime
        };
    }

    /**
     * Get order counts
     * @returns {OrderCounts} Current order counts
     */
    getOrderCounts() {
        return { ...this.#status.orderCounts };
    }

    /**
     * Check if system is online
     * @returns {boolean} Online status
     */
    isOnline() {
        return this.#status.online;
    }

    /**
     * Get last error
     * @returns {Error|null} Last error
     */
    getLastError() {
        return this.#status.error;
    }

    /**
     * Set error status
     * @param {Error} error Error object
     */
    async setError(error) {
        this.#status.error = error;
        
        // Emit error event
        const event = await this.getDependency('event');
        await event.emit('status:error', {
            error,
            timestamp: Date.now()
        });
    }

    /**
     * Clear error status
     */
    async clearError() {
        this.#status.error = null;
        
        // Emit error cleared event
        const event = await this.getDependency('event');
        await event.emit('status:error-cleared', {
            timestamp: Date.now()
        });
    }

    /**
     * Handle online/offline status change
     * @private
     */
    async #handleOnlineStatus(online) {
        this.#status.online = online;
        
        // Emit online status event
        const event = await this.getDependency('event');
        await event.emit('status:online', {
            online,
            timestamp: Date.now()
        });

        // Show notification
        if (!online) {
            const notification = await this.getDependency('notification');
            await notification.show('Offline Mode', 'Working in offline mode. Some features may be limited.', {
                type: 'warning',
                duration: 0 // Persistent until back online
            });
        }
    }

    /**
     * Start status update interval
     * @private
     */
    #startStatusUpdates() {
        if (this.#updateInterval) {
            clearInterval(this.#updateInterval);
        }

        this.#updateInterval = setInterval(
            () => this.#updateStatus(),
            STATUS_CONFIG.UPDATE_INTERVAL
        );
    }

    /**
     * Update status
     * @private
     */
    async #updateStatus() {
        try {
            // Check if we need to show notifications
            await this.#checkForSignificantChanges();

            // Emit status update event
            const event = await this.getDependency('event');
            await event.emit('status:updated', {
                type: 'periodic',
                status: this.getStatus(),
                timestamp: Date.now()
            });
        } catch (error) {
            this.handleError(error, ErrorType.STATUS_UPDATE, ErrorSeverity.LOW);
        }
    }

    /**
     * Get status manager metrics
     * @returns {Object} Metrics object
     */
    getMetrics() {
        return {
            ...super.getMetrics(),
            status: {
                uptime: Date.now() - this._startTime,
                lastUpdate: this.#status.lastUpdate,
                notificationCount: this.#notificationCount,
                online: this.#status.online
            }
        };
    }
}

// Export class only
export { StatusManager }; 