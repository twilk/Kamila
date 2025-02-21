import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { UPDATE_CONFIG } from '../../config/update.js';

// Add at the top after imports
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

// Development mode detection
function isDevelopment() {
    try {
        return !chrome.runtime.getManifest().update_url;
    } catch (e) {
        return false;
    }
}

/**
 * @extends {BaseManager}
 * Manages extension updates and version checks
 */
class UpdateManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;

    // Private fields
    #currentVersion = null;
    #lastCheck = 0;
    #checkInterval = 60 * 60 * 1000; // 1 hour
    #updateInProgress = false;
    #updateQueue = [];
    #settings = null;
    #eventManager = null;
    #updateCheckTimer = null;
    #updateCheckInterval = 60 * 60 * 1000; // 1 hour
    #lastUpdateCheck = 0;

    // Private method declarations
    #handleUpdateAvailable = null;
    #handleUpdateStart = null;
    #handleUpdateComplete = null;
    #handleUpdateError = null;
    #saveState = null;
    #startUpdateCheck = null;

    constructor(registry) {
        if (UpdateManager.#instance) {
            return UpdateManager.#instance;
        }
        super(registry, 'UpdateManager');
        UpdateManager.#instance = this;
        UpdateManager._registry = registry;
        this.#currentVersion = chrome.runtime.getManifest().version;
        this.#updateCheckInterval = UPDATE_CHECK_INTERVAL;
        this.#lastUpdateCheck = 0;

        // Initialize private methods
        this.#handleUpdateAvailable = async (details) => {
            try {
                this.log(LogLevel.INFO, '🔄 Update available', { version: details.version });
                
                // Notify user
                const notificationManager = await this.getDependency('notification');
                const orderManager = await this.getDependency('order');
                const eventManager = await this.getDependency('event');
                
                await notificationManager.showUpdateNotification(details.version);
                await orderManager.refreshData();
                await eventManager.emit('update-start', details);
            } catch (error) {
                this.handleError(error, ErrorType.UPDATE, ErrorSeverity.MEDIUM, {
                    method: '#handleUpdateAvailable'
                });
            }
        };

        this.#handleUpdateStart = async (details) => {
            try {
                this.#updateInProgress = true;
                this.log(LogLevel.INFO, '🔄 Starting update process', details);
                
                // Save current state
                await this.#saveState();
                
                // Notify user
                const notificationManager = await this.getDependency('notification');
                await notificationManager.showUpdateStartNotification();
            } catch (error) {
                this.handleError(error, ErrorType.UPDATE, ErrorSeverity.MEDIUM, {
                    method: '#handleUpdateStart'
                });
            }
        };

        this.#handleUpdateComplete = async (details) => {
            try {
                this.log(LogLevel.SUCCESS, '✅ Update completed', details);
                
                const orderManager = await this.getDependency('order');
                const notificationManager = await this.getDependency('notification');
                
                // Refresh data after update
                await orderManager.refreshData();
                
                // Reset update flag
                this.#updateInProgress = false;
                
                // Notify user
                await notificationManager.showUpdateCompleteNotification();
            } catch (error) {
                this.handleError(error, ErrorType.UPDATE, ErrorSeverity.MEDIUM, {
                    method: '#handleUpdateComplete'
                });
            }
        };

        this.#handleUpdateError = async (error) => {
            try {
                this.log(LogLevel.ERROR, '❌ Update failed', { error });
                
                const orderManager = await this.getDependency('order');
                const notificationManager = await this.getDependency('notification');
                
                // Reset update flag
                this.#updateInProgress = false;
                
                // Notify user
                await notificationManager.showUpdateErrorNotification(error);
                
                // Refresh data to ensure consistency
                await orderManager.refreshData();
            } catch (err) {
                this.handleError(err, ErrorType.UPDATE, ErrorSeverity.HIGH, {
                    method: '#handleUpdateError',
                    originalError: error
                });
            }
        };

        this.#saveState = async () => {
            try {
                const state = {
                    version: this.#currentVersion,
                    timestamp: Date.now(),
                    orders: managers.orderManager.getCache()
                };
                
                await chrome.storage.local.set({ updateState: state });
                this.log(LogLevel.DEBUG, '💾 State saved before update', state);
            } catch (error) {
                this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                    method: '#saveState'
                });
            }
        };

        this.#startUpdateCheck = () => {
            if (isDevelopment()) {
                this.log(LogLevel.INFO, '🔄 Update check interval disabled in development mode');
                return;
            }

            if (this.#updateCheckTimer) {
                clearInterval(this.#updateCheckTimer);
            }

            this.log(LogLevel.INFO, `🔄 Starting update check interval (${this.#updateCheckInterval}ms)`);
            this.#updateCheckTimer = setInterval(() => {
                this.checkForUpdates().catch(error => {
                    this.handleError(error, ErrorType.UPDATE, ErrorSeverity.LOW, {
                        method: '_startUpdateCheck'
                    });
                });
            }, this.#updateCheckInterval);
        };
    }

    /**
     * Get singleton instance
     * @returns {UpdateManager}
     */
    static getInstance() {
        if (!UpdateManager.#instance && UpdateManager._registry) {
            UpdateManager.#instance = new UpdateManager(UpdateManager._registry);
        }
        return UpdateManager.#instance;
    }

    static setRegistry(registry) {
        UpdateManager._registry = registry;
    }

    /**
     * Initialize update manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing update manager...');
            
            // Load update settings
            const storage = await this.getDependency('storage');
            const settings = await storage.get(UPDATE_CONFIG.STORAGE_KEY) || {};
            this.#settings = { ...UPDATE_CONFIG.DEFAULT_SETTINGS, ...settings };
            
            // Set up event listeners
            this.#setupEventListeners();
            
            this.log(LogLevel.SUCCESS, '✅ Update manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Set up event listeners
     * @private
     */
    async #setupEventListeners() {
        try {
            const eventManager = await this.getDependency('event');
            
            // Listen for update events
            await eventManager.on('update-available', this.#handleUpdateAvailable.bind(this));
            await eventManager.on('update-start', this.#handleUpdateStart.bind(this));
            await eventManager.on('update-complete', this.#handleUpdateComplete.bind(this));
            await eventManager.on('update-error', this.#handleUpdateError.bind(this));
            
            // Start update check interval
            this.#startUpdateCheck();
            
            this.log(LogLevel.DEBUG, '🔄 Update event listeners set up');
        } catch (error) {
            this.handleError(error, ErrorType.EVENT_LISTENER, ErrorSeverity.HIGH, {
                method: '#setupEventListeners'
            });
            throw error;
        }
    }

    /**
     * Check for updates
     * @returns {Promise<void>}
     */
    async checkForUpdates() {
        if (this.#updateInProgress) {
            this.log(LogLevel.DEBUG, '🔄 Update in progress, skipping check');
            return;
        }

        if (isDevelopment()) {
            this.log(LogLevel.DEBUG, '🔄 Update checks disabled in development mode');
            return;
        }

        try {
            const now = Date.now();
            if (now - this.#lastCheck < 60000) {
                this.log(LogLevel.DEBUG, '🔄 Skipping update check - too soon since last check');
                return;
            }
            this.#lastCheck = now;

            this.log(LogLevel.INFO, '🔄 Checking for updates...');
            const manifest = chrome.runtime.getManifest();
            const response = await fetch('https://darwina.pl/api/version');
            const { version } = await response.json();

            this.log(LogLevel.INFO, '🔄 Version check:', {
                current: manifest.version,
                latest: version
            });

            if (version && version !== manifest.version) {
                this.log(LogLevel.INFO, '🔄 New version available!', {
                    current: manifest.version,
                    latest: version
                });
                managers.eventManager.emit('update-available', { version });
            }
        } catch (error) {
            this.handleError(error, ErrorType.UPDATE, ErrorSeverity.LOW, {
                method: 'checkForUpdates'
            });
        }
    }

    /**
     * Get current extension version
     * @returns {string} Current version
     */
    getCurrentVersion() {
        return this.#currentVersion;
    }

    /**
     * Check if update is in progress
     * @returns {boolean} Update status
     */
    isUpdating() {
        return this.#updateInProgress;
    }

    /**
     * Clean up resources
     */
    async dispose() {
        if (this.#updateCheckTimer) {
            clearInterval(this.#updateCheckTimer);
            this.#updateCheckTimer = null;
        }
        await super.dispose();
    }
}

// Export both class and instance
export { UpdateManager };
export const updateManager = UpdateManager.getInstance();
