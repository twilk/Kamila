import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity, LogLevel } from '../index.js';
import { uiManager } from './UIManager.js';
import { eventManager } from './EventManager.js';
import { environment } from './environment.js';

/**
 * @typedef {Object} OrderCounts
 * @property {number} '1' - Liczba zamówień w statusie submitted
 * @property {number} '2' - Liczba zamówień w statusie confirmed
 * @property {number} '3' - Liczba zamówień w statusie accepted
 * @property {number} 'READY' - Liczba zamówień gotowych do odbioru
 * @property {number} 'OVERDUE' - Liczba zamówień przeterminowanych
 */

/**
 * @typedef {Object} StatusMapType
 * @property {string} submitted - Status dla nowych zamówień
 * @property {string} confirmed - Status dla potwierdzonych zamówień
 * @property {string} accepted - Status dla zaakceptowanych zamówień
 * @property {string} ready - Status dla zamówień gotowych
 * @property {string} overdue - Status dla zamówień przeterminowanych
 */

// Constants
/** @type {StatusMapType} */
export const STATUS_MAP = {
    submitted: '1',
    confirmed: '2',
    accepted: '3',
    ready: 'READY',
    overdue: 'OVERDUE'
};

/**
 * @extends {BaseManager}
 * Manages application status, health checks and order counters
 */
export class StatusManager extends BaseManager {
    static #instance = null;
    #services = {
        api: false,
        auth: false,
        orders: false,
        cache: false
    };
    #updateInterval = null;
    #pendingUIUpdates = new Set();
    #baseUrl = 'https://darwina.pl';
    #dataManager = null;

    constructor() {
        if (StatusManager.#instance) {
            throw new Error('Use StatusManager.getInstance()');
        }
        super('StatusManager');
        StatusManager.#instance = this;
        
        // Add dependencies
        this.addDependency(uiManager);
        this.addDependency(eventManager);
    }

    /**
     * Get singleton instance
     * @returns {StatusManager}
     */
    static getInstance() {
        if (!StatusManager.#instance) {
            StatusManager.#instance = new StatusManager();
        }
        return StatusManager.#instance;
    }

    /**
     * Initialize status manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            this.log(LogLevel.INFO, '🚀 Starting initialization of StatusManager');
            
            // Get dependencies
            const eventManager = this.getDependency('EventManager');
            if (!eventManager?.isInitialized()) {
                throw new Error('EventManager must be initialized');
            }

            // Import DataManager dynamically to avoid circular dependency
            const { dataManager } = await import('./DataManager.js');
            this.#dataManager = dataManager;
            
            if (!this.#dataManager?.isInitialized()) {
                throw new Error('DataManager must be initialized');
            }

            // Setup event listeners
            eventManager.on('ui:ready', () => this.#processPendingUIUpdates());
            eventManager.on('service:status', ({ service, status }) => this.updateStatus(service, status));
            
            // Listen for store changes to update order counts
            eventManager.on('store:change', async ({ storeId }) => {
                try {
                    // Load fresh data when store changes
                    await this.#dataManager.loadAndUpdateData(true);
                } catch (error) {
                    this.handleError(error, ErrorType.EVENT, ErrorSeverity.LOW, {
                        method: 'onStoreChange',
                        storeId
                    });
                }
            });
            
            // Start with initial status check
            await this.checkAllServices();
            
            // Load initial data
            await this.#dataManager.loadAndUpdateData(true);
            
            // Setup periodic checks
            this.#startPeriodicChecks();

            this.log(LogLevel.SUCCESS, '✨ Status manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'onInitialize'
            });
            return false;
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
            eventManager.emit('status:change', {
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
            const ui = this.getDependency('UIManager');
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
            const uiManager = this.getDependency('UIManager');
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
     */
    async dispose() {
        if (this.#updateInterval) {
            clearInterval(this.#updateInterval);
            this.#updateInterval = null;
        }
        this.#pendingUIUpdates.clear();
        await super.dispose();
    }

    // Private service check methods...
    async #checkApiStatus() {
        try {
            if (environment.isDevelopment) {
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
     * Map status to internal status code
     * @param {string} status - Status to map
     * @returns {string} Internal status code
     */
    static mapStatus(status) {
        return STATUS_MAP[status.toLowerCase()] || status;
    }

    /**
     * Update order counts and UI
     * @param {Object} counts - Order counts by status
     * @returns {Promise<void>}
     */
    async updateOrderCounts(counts) {
        try {
            // Get dependencies
            const eventManager = this.getDependency('EventManager');
            const uiManager = this.getDependency('UIManager');

            if (!eventManager?.isInitialized()) {
                throw new Error('EventManager must be initialized');
            }

            if (!uiManager?.isInitialized()) {
                throw new Error('UIManager must be initialized');
            }

            // Save counts to storage
            await chrome.storage.local.set({ orderCounts: counts });

            // Update UI for each status
            Object.entries(counts).forEach(([status, count]) => {
                const elementId = `count-${status}`;
                this.#pendingUIUpdates.add({
                    elementId,
                    value: count,
                    type: 'count'
                });
            });

            // Process UI updates if possible
            if (uiManager.isInitialized()) {
                await this.#processPendingUIUpdates();
            }

            // Emit event with updated counts
            eventManager.emit('orders:counts-updated', { counts });

            this.log(LogLevel.DEBUG, '📊 Order counts updated', { counts });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'updateOrderCounts'
            });
        }
    }
}

// Export singleton instance
export const statusManager = StatusManager.getInstance(); 