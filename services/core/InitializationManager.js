import { BaseManager } from './BaseManager.js';
import { ErrorHandler, errorHandler } from './ErrorHandler.js';
import { LogLevel } from './LogLevel.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { InitialLoadingManager, loadingManager } from './LoadingManager.js';
import { eventManager } from './EventManager.js';
import { connectionManager } from './ConnectionManager.js';
import { cacheManager } from './CacheManager.js';
import { uiManager } from './UIManager.js';
import { debugManager } from './DebugManager.js';
import { themeManager } from './ThemeManager.js';
import { progressManager } from './ProgressManager.js';
import { menuManager } from './MenuManager.js';
import { languageManager } from './LanguageManager.js';
import { storeManager } from './StoreManager.js';
import { interfaceManager } from './InterfaceManager.js';
import { dataManager } from './DataManager.js';
import { userManager } from './UserManager.js';
import { updateManager } from './UpdateManager.js';
import { refreshManager } from './RefreshManager.js';
import { rankingManager } from './RankingManager.js';
import { settingsManager } from './SettingsManager.js';
import { messageManager } from './MessageManager.js';
import { notificationManager } from './NotificationManager.js';
import { volumeManager } from './VolumeManager.js';
import { managers, registerManagers } from './managers.js';

/**
 * @extends {BaseManager}
 * Manages initialization of Chrome extension managers
 */
export class InitializationManager extends BaseManager {
    static #instance = null;
    #managers = new Map();
    #initialized = false;
    #initializationPromise = null;
    #loadingManager = null;
    #startTime = null;

    constructor() {
        if (InitializationManager.#instance) {
            return InitializationManager.#instance;
        }
        super('InitializationManager');
        InitializationManager.#instance = this;
    }

    /**
     * @returns {InitializationManager}
     */
    static getInstance() {
        if (!InitializationManager.#instance) {
            InitializationManager.#instance = new InitializationManager();
        }
        return InitializationManager.#instance;
    }

    /**
     * Initialize the initialization manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        if (this.#initializationPromise) {
            return this.#initializationPromise;
        }

        this.#initializationPromise = (async () => {
            try {
                this.#startTime = performance.now();
                console.log('[DEBUG] 🚀 Starting initialization...');

                // Ensure ErrorHandler is initialized first
                if (!errorHandler.isReady()) {
                    await errorHandler.initialize();
                }

                // Initialize InitialLoadingManager first
                this.#loadingManager = loadingManager;
                if (!this.#loadingManager.isInitialized()) {
                    await this.#loadingManager.initialize();
                }
                await this.#loadingManager.startLoading(22); // Total number of managers to initialize

                // Initialize core managers in correct order
                const managersToInitialize = [
                    { instance: errorHandler, name: 'Error Handler' },
                    { instance: eventManager, name: 'Event Manager' },
                    { instance: connectionManager, name: 'Connection Manager' },
                    { instance: cacheManager, name: 'Cache Manager' },
                    { instance: uiManager, name: 'UI Manager' },
                    { instance: themeManager, name: 'Theme Manager' },
                    { instance: debugManager, name: 'Debug Manager' },
                    { instance: volumeManager, name: 'Volume Manager' },
                    { instance: progressManager, name: 'Progress Manager' },
                    { instance: menuManager, name: 'Menu Manager' },
                    { instance: languageManager, name: 'Language Manager' },
                    { instance: storeManager, name: 'Store Manager' },
                    { instance: interfaceManager, name: 'Interface Manager' },
                    { instance: dataManager, name: 'Data Manager' },
                    { instance: managers.StatusManager, name: 'Status Manager' },
                    { instance: userManager, name: 'User Manager' },
                    { instance: notificationManager, name: 'Notification Manager' },
                    { instance: updateManager, name: 'Update Manager' },
                    { instance: refreshManager, name: 'Refresh Manager' },
                    { instance: rankingManager, name: 'Ranking Manager' },
                    { instance: settingsManager, name: 'Settings Manager' },
                    { instance: messageManager, name: 'Message Manager' }
                ];

                // Initialize each manager
                for (const [index, { instance, name }] of managersToInitialize.entries()) {
                    try {
                        if (!instance) {
                            console.warn(`[WARNING] ⚠️ Manager ${name} not found`);
                            await this.#loadingManager.updateProgress(index + 1, `${name} (not found)`);
                            continue;
                        }
                        
                        if (instance.isReady()) {
                            console.log(`[DEBUG] ⏭️ ${name} already ready`);
                            await this.#loadingManager.updateProgress(index + 1, `${name} (skipped)`);
                            continue;
                        }

                        console.log(`[DEBUG] 🚀 Initializing ${name}...`);
                        await instance.initialize();
                        await this.#loadingManager.updateProgress(index + 1, name);
                        console.log(`[DEBUG] ✅ ${name} initialized`);
                    } catch (error) {
                        console.error(`[ERROR] ❌ Failed to initialize ${name}:`, error);
                        await this.#loadingManager.updateProgress(index + 1, `${name} (error)`);
                        throw error;
                    }
                }

                // Only finish loading if we haven't already
                if (!this.#initialized) {
                    await this.#loadingManager.finishLoading();
                    this.#initialized = true;
                }

                const duration = performance.now() - this.#startTime;
                this.log(LogLevel.SUCCESS, `✅ InitializationManager initialized in ${duration.toFixed(2)}ms`);
                return true;
            } catch (error) {
                console.error('[ERROR] ❌ Initialization failed:', error);
                if (errorHandler.isReady()) {
                    errorHandler.handleError(error);
                }
                // Ensure loading screen is hidden even on error, but only if not already initialized
                if (this.#loadingManager.isReady() && !this.#initialized) {
                    await this.#loadingManager.finishLoading(true);
                }
                return false;
            } finally {
                this.#initializationPromise = null;
            }
        })();

        return this.#initializationPromise;
    }

    /**
     * Get all registered managers
     * @returns {Object} Map of manager instances
     */
    getManagers() {
        return this.#managers;
    }

    /**
     * Cleanup and dispose
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            if (this.#managers) {
                for (const manager of Object.values(this.#managers)) {
                    await manager.dispose();
                }
            }
            await super.dispose();
            return true;
        } catch (error) {
            if (errorHandler.isReady()) {
                errorHandler.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH);
            }
            return false;
        }
    }
}

// Export singleton instance
export const initializationManager = InitializationManager.getInstance();