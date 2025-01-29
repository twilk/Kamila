import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { environment } from './environment.js';
import { eventManager } from './EventManager.js';
import { notificationManager } from './NotificationManager.js';

/**
 * @extends {BaseManager}
 * Manages extension updates and version checks
 */
export class UpdateManager extends BaseManager {
    /** @private */
    static #instance = null;
    
    /** @private */
    #currentVersion = null;
    
    /** @private */
    #updateCheckInterval = 1000 * 60 * 60; // 1 hour
    
    /** @private */
    #updateCheckTimer = null;

    /** @private */
    #lastCheck = 0;

    constructor() {
        super('UpdateManager');
        
        if (UpdateManager.#instance) {
            return UpdateManager.#instance;
        }
        
        UpdateManager.#instance = this;
        this.#currentVersion = environment.manifestVersion;
        
        // Add required dependencies
        this.addDependency(eventManager);
        this.addDependency(notificationManager);
    }

    /**
     * Get singleton instance
     * @returns {UpdateManager}
     */
    static getInstance() {
        if (!UpdateManager.#instance) {
            UpdateManager.#instance = new UpdateManager();
        }
        return UpdateManager.#instance;
    }

    /**
     * Initialize update manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing update manager...');
            
            // Get dependencies
            const eventManager = this.getDependency('EventManager');
            const notificationManager = this.getDependency('NotificationManager');
            
            if (!eventManager?.isReady()) {
                throw new Error('EventManager must be ready');
            }

            if (!notificationManager?.isReady()) {
                throw new Error('NotificationManager must be ready');
            }

            // Setup update handler
            eventManager.on('update-available', (details) => {
                this.log(LogLevel.INFO, '🔄 Update available', { version: details.version });
                notificationManager.showUpdateNotification(details.version);
            });

            // Initial update check
            await this.checkForUpdates();
            
            // Start periodic checks
            this.#startUpdateCheck();
            
            this.log(LogLevel.SUCCESS, '✅ Update manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'onInitialize'
            });
            return false;
        }
    }

    /**
     * Start update check interval
     * @private
     */
    #startUpdateCheck() {
        if (environment.isDevelopment || environment.isProduction) {
            this.log(LogLevel.INFO, '🔄 Update check interval disabled in development/production mode');
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
    }

    /**
     * Check for updates
     * @returns {Promise<void>}
     */
    async checkForUpdates() {
        if (environment.isDevelopment || environment.isProduction) {
            this.log(LogLevel.DEBUG, '🔄 Update checks disabled in development/production mode');
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
                eventManager.emit('update-available', { version });
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

// Export singleton instance
export const updateManager = UpdateManager.getInstance(); 