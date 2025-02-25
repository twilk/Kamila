import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { INTERVALS, REFRESH_CONFIG } from '../../config/intervals.js';

/**
 * @extends {BaseManager}
 * Manages data refresh intervals and auto-refresh functionality
 */
class RefreshManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;

    /** @private */
    #settings;

    /** @private */
    #intervals = {
        check: null,
        notification: null,
        fullRefresh: null,
        deltaUpdate: null
    };

    constructor(registry) {
        if (RefreshManager.#instance) {
            return RefreshManager.#instance;
        }
        super(registry, 'RefreshManager');
        RefreshManager.#instance = this;
        RefreshManager._registry = registry;
        
        // Add dependencies
        this.addDependency('event');
        this.addDependency('order');
    }

    static getInstance() {
        if (!RefreshManager.#instance && RefreshManager._registry) {
            RefreshManager.#instance = new RefreshManager(RefreshManager._registry);
        }
        return RefreshManager.#instance;
    }

    static setRegistry(registry) {
        RefreshManager._registry = registry;
    }

    /**
     * Initialize refresh manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing refresh manager...');
            
            // Load refresh settings
            const storage = await this.getDependency('storage');
            const settings = await storage.get(REFRESH_CONFIG.STORAGE_KEY) || {};
            this.#settings = { ...REFRESH_CONFIG.DEFAULT_SETTINGS, ...settings };
            
            // Set up event listeners
            this.#setupEventListeners();
            
            this.log(LogLevel.SUCCESS, '✅ Refresh manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    async handleRefreshNeeded() {
        try {
            this.log(LogLevel.INFO, '🔄 Handling refresh needed event');
            const [orderManager, eventManager] = await Promise.all([
                this.getDependency('order'),
                this.getDependency('event')
            ]);
            
            await orderManager.refreshData();
            eventManager.emit('refresh:complete');
        } catch (error) {
            const eventManager = await this.getDependency('event');
            this.handleError(error, ErrorType.REFRESH, ErrorSeverity.MEDIUM);
            eventManager.emit('refresh:error', error);
        }
    }

    async handleManualRefresh() {
        try {
            this.log(LogLevel.INFO, '🔄 Handling manual refresh request');
            const [orderManager, eventManager] = await Promise.all([
                this.getDependency('order'),
                this.getDependency('event')
            ]);
            
            await orderManager.refreshData(true);
            eventManager.emit('refresh:complete');
        } catch (error) {
            const eventManager = await this.getDependency('event');
            this.handleError(error, ErrorType.REFRESH, ErrorSeverity.MEDIUM);
            eventManager.emit('refresh:error', error);
        }
    }

    /**
     * Wait for OrderManager initialization
     * @private
     * @returns {Promise<void>}
     */
    async #waitForOrderManager(maxAttempts = 10, interval = 1000) {
        let attempts = 0;
        const orderManager = await this.getDependency('order');
        
        while (!orderManager.isInitialized() && attempts < maxAttempts) {
            this.log(LogLevel.INFO, `⏳ Waiting for OrderManager (attempt ${attempts + 1}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, interval));
            attempts++;
        }
        
        if (!orderManager.isInitialized()) {
            throw new Error('OrderManager initialization timeout');
        }
    }

    /**
     * Load refresh settings from storage
     * @private
     */
    async _loadSettings() {
        try {
            const settings = await chrome.storage.local.get(Object.keys(this.#settings));
            this.#settings = { ...this.#settings, ...settings };
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM, {
                method: '_loadSettings'
            });
        }
    }

    /**
     * Set up refresh-related event listeners
     * @private
     */
    #setupEventListeners() {
        document.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => this._handleSettingChange(e));
        });
    }

    /**
     * Handle setting change event
     * @private
     * @param {Event} event Change event
     */
    async _handleSettingChange(event) {
        try {
            const { name, value } = event.target;
            if (name in this.#settings) {
                this.#settings[name] = value;
                await chrome.storage.local.set({ [name]: value });
                this._applySettings();
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: '_handleSettingChange'
            });
        }
    }

    /**
     * Apply current refresh settings
     * @private
     */
    async _applySettings() {
        try {
            // Clear existing intervals
            Object.values(this.#intervals).forEach(interval => {
                if (interval) clearInterval(interval);
            });

            // Set up new intervals based on settings
            if (this.#settings.check_frequency !== 'off') {
                const checkMs = this._getMilliseconds(this.#settings.check_frequency);
                this.#intervals.check = setInterval(() => this.checkRefresh(), checkMs);
                this.log(LogLevel.INFO, '✅ Check frequency interval updated', {
                    interval: this.#settings.check_frequency,
                    milliseconds: checkMs
                });
            }

            if (this.#settings.notification_interval !== 'off') {
                const notifyMs = this._getMilliseconds(this.#settings.notification_interval);
                this.#intervals.notification = setInterval(() => this.notifyRefresh(), notifyMs);
                this.log(LogLevel.INFO, '✅ Notification interval updated', {
                    interval: this.#settings.notification_interval,
                    milliseconds: notifyMs
                });
            }

            if (this.#settings.full_refresh !== 'off') {
                const refreshMs = this._getMilliseconds(this.#settings.full_refresh);
                this.#intervals.fullRefresh = setInterval(() => this.fullRefresh(), refreshMs);
                this.log(LogLevel.INFO, '✅ Full refresh interval updated', {
                    interval: this.#settings.full_refresh,
                    milliseconds: refreshMs
                });
            }

            if (this.#settings.delta_update !== 'off') {
                const deltaMs = this._getMilliseconds(this.#settings.delta_update);
                this.#intervals.deltaUpdate = setInterval(() => this.deltaUpdate(), deltaMs);
                this.log(LogLevel.INFO, '✅ Delta update interval updated', {
                    interval: this.#settings.delta_update,
                    milliseconds: deltaMs
                });
            }

            // Update UI
            this._updateUI();
        } catch (error) {
            this.handleError(error, ErrorType.REFRESH, ErrorSeverity.MEDIUM, {
                method: '_applySettings'
            });
        }
    }

    /**
     * Convert interval string to milliseconds
     * @private
     * @param {string} interval Interval string (e.g., '5m', '1h')
     * @returns {number} Milliseconds
     */
    _getMilliseconds(interval) {
        const value = parseInt(interval);
        const unit = interval.slice(-1);
        const multipliers = {
            's': 1000,
            'm': 60 * 1000,
            'h': 60 * 60 * 1000
        };
        return value * (multipliers[unit] || 0);
    }

    /**
     * Update UI to reflect current settings
     * @private
     */
    _updateUI() {
        Object.entries(this.#settings).forEach(([name, value]) => {
            const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
            if (radio) {
                radio.checked = true;
            }
        });
    }

    /**
     * Perform data check
     * @private
     */
    async checkRefresh() {
        try {
            const [eventManager, orderManager] = await Promise.all([
                this.getDependency('event'),
                this.getDependency('order')
            ]);
            
            eventManager.emit('refresh:check');
            
            // Check data freshness through OrderManager
            const orders = orderManager.getCache();
            if (orders.length > 0) {
                eventManager.emit('refresh:data-fresh', {
                    count: orders.length,
                    timestamp: Date.now()
                });
            }
            
            this.log(LogLevel.DEBUG, '🔄 Refresh check completed');
        } catch (error) {
            this.handleError(error, ErrorType.REFRESH, ErrorSeverity.LOW, {
                method: 'checkRefresh'
            });
        }
    }

    /**
     * Show notification
     * @private
     */
    async notifyRefresh() {
        try {
            const eventManager = await this.getDependency('event');
            eventManager.emit('refresh:notify');
            this.log(LogLevel.DEBUG, '🔔 Refresh notification sent');
        } catch (error) {
            this.handleError(error, ErrorType.NOTIFICATION, ErrorSeverity.LOW, {
                method: 'notifyRefresh'
            });
        }
    }

    /**
     * Perform full data refresh
     * @private
     */
    async fullRefresh() {
        try {
            this.log(LogLevel.INFO, '🔄 Starting full refresh...');
            
            const [eventManager, orderManager] = await Promise.all([
                this.getDependency('event'),
                this.getDependency('order')
            ]);
            
            eventManager.emit('refresh:full-start');
            
            // Perform full refresh through OrderManager
            await orderManager.refreshData();
            
            eventManager.emit('refresh:full-complete', {
                timestamp: Date.now()
            });
            
            this.log(LogLevel.SUCCESS, '✅ Full refresh completed');
        } catch (error) {
            const eventManager = await this.getDependency('event');
            this.handleError(error, ErrorType.REFRESH, ErrorSeverity.MEDIUM, {
                method: 'fullRefresh'
            });
            eventManager.emit('refresh:full-error', { error });
        }
    }

    /**
     * Perform delta update
     * @private
     */
    async deltaUpdate() {
        try {
            this.log(LogLevel.INFO, '🔄 Starting delta update...');
            
            const [eventManager, orderManager] = await Promise.all([
                this.getDependency('event'),
                this.getDependency('order')
            ]);
            
            eventManager.emit('refresh:delta-start');
            
            // Perform delta update through OrderManager
            await orderManager.fetchDeltaUpdates();
            
            eventManager.emit('refresh:delta-complete', {
                timestamp: Date.now()
            });
            
            this.log(LogLevel.SUCCESS, '✅ Delta update completed');
        } catch (error) {
            const eventManager = await this.getDependency('event');
            this.handleError(error, ErrorType.REFRESH, ErrorSeverity.LOW, {
                method: 'deltaUpdate'
            });
            eventManager.emit('refresh:delta-error', { error });
        }
    }

    /**
     * Get current settings
     * @returns {Object} Current settings
     */
    getSettings() {
        return { ...this.#settings };
    }

    /**
     * Update a specific setting
     * @param {string} name Setting name
     * @param {string} value Setting value
     */
    async updateSetting(name, value) {
        try {
            if (name in this.#settings) {
                this.#settings[name] = value;
                await chrome.storage.local.set({ [name]: value });
                await this._applySettings();
            }
        } catch (error) {
            this.handleError(error, ErrorType.REFRESH, ErrorSeverity.LOW, {
                method: 'updateSetting',
                name,
                value
            });
        }
    }

    /**
     * Cleanup and dispose
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            // Clear all intervals
            Object.values(this.#intervals).forEach(interval => {
                if (interval) clearInterval(interval);
            });

            // Remove event listeners
            document.querySelectorAll('input[type="radio"]').forEach(radio => {
                radio.removeEventListener('change', this._handleSettingChange);
            });

            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
        }
    }
}

// Export both class and instance
export { RefreshManager };
export const refreshManager = RefreshManager.getInstance(); 
