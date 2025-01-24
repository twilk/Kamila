import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { INTERVALS } from '../../config/intervals.js';

/**
 * @extends {BaseManager}
 * Manages data refresh intervals and auto-refresh functionality
 */
export class RefreshManager extends BaseManager {
    static _instance = null;

    static getInstance() {
        if (!RefreshManager._instance) {
            RefreshManager._instance = new RefreshManager();
        }
        return RefreshManager._instance;
    }

    constructor() {
        super('RefreshManager');
        if (RefreshManager._instance) {
            throw new Error('Use RefreshManager.getInstance()');
        }
        RefreshManager._instance = this;
        this._intervals = {
            check: null,
            notification: null,
            fullRefresh: null
        };
        this._settings = {
            check_frequency: 'off',
            notification_interval: 'off',
            full_refresh: 'off',
            data_freshness: 'off'
        };
    }

    /**
     * Initialize refresh manager
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            await super.initialize();
            await this._loadSettings();
            this._setupEventListeners();
            this._applySettings();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
    }

    /**
     * Load refresh settings from storage
     * @private
     */
    async _loadSettings() {
        try {
            const settings = await chrome.storage.local.get(Object.keys(this._settings));
            this._settings = { ...this._settings, ...settings };
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
    _setupEventListeners() {
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
            if (name in this._settings) {
                this._settings[name] = value;
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
    _applySettings() {
        try {
            // Clear existing intervals
            Object.values(this._intervals).forEach(interval => {
                if (interval) clearInterval(interval);
            });

            // Set up new intervals based on settings
            if (this._settings.check_frequency !== 'off') {
                const checkMs = this._getMilliseconds(this._settings.check_frequency);
                this._intervals.check = setInterval(() => this._performCheck(), checkMs);
            }

            if (this._settings.notification_interval !== 'off') {
                const notifyMs = this._getMilliseconds(this._settings.notification_interval);
                this._intervals.notification = setInterval(() => this._showNotification(), notifyMs);
            }

            if (this._settings.full_refresh !== 'off') {
                const refreshMs = this._getMilliseconds(this._settings.full_refresh);
                this._intervals.fullRefresh = setInterval(() => this._performFullRefresh(), refreshMs);
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
        Object.entries(this._settings).forEach(([name, value]) => {
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
    async _performCheck() {
        try {
            // Implement check logic
            const event = new CustomEvent('refresh:check');
            document.dispatchEvent(event);
        } catch (error) {
            this.handleError(error, ErrorType.REFRESH, ErrorSeverity.LOW, {
                method: '_performCheck'
            });
        }
    }

    /**
     * Show notification
     * @private
     */
    async _showNotification() {
        try {
            // Implement notification logic
            const event = new CustomEvent('refresh:notify');
            document.dispatchEvent(event);
        } catch (error) {
            this.handleError(error, ErrorType.REFRESH, ErrorSeverity.LOW, {
                method: '_showNotification'
            });
        }
    }

    /**
     * Perform full data refresh
     * @private
     */
    async _performFullRefresh() {
        try {
            // Implement full refresh logic
            const event = new CustomEvent('refresh:full');
            document.dispatchEvent(event);
        } catch (error) {
            this.handleError(error, ErrorType.REFRESH, ErrorSeverity.MEDIUM, {
                method: '_performFullRefresh'
            });
        }
    }

    /**
     * Get current settings
     * @returns {Object} Current settings
     */
    getSettings() {
        return { ...this._settings };
    }

    /**
     * Update a specific setting
     * @param {string} name Setting name
     * @param {string} value Setting value
     */
    async updateSetting(name, value) {
        try {
            if (name in this._settings) {
                this._settings[name] = value;
                await chrome.storage.local.set({ [name]: value });
                this._applySettings();
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
            Object.values(this._intervals).forEach(interval => {
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

// Export singleton instance
export const refreshManager = RefreshManager.getInstance(); 