import { BaseManager } from './BaseManager.js';
import { ErrorHandler, errorHandler } from './ErrorHandler.js';
import { LogLevel } from './LogLevel.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LoadingManager, loadingManager } from './LoadingManager.js';
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
import { statusManager } from './StatusManager.js';
import { userManager } from './UserManager.js';
import { updateManager } from './UpdateManager.js';
import { refreshManager } from './RefreshManager.js';
import { rankingManager } from './RankingManager.js';
import { settingsManager } from './SettingsManager.js';
import { messageManager } from './MessageManager.js';
import { notificationManager } from './NotificationManager.js';
import { managers, registerManagers } from './managers.js';

/**
 * Manager responsible for coordinating initialization of Chrome extension managers
 */
export class InitializationManager extends BaseManager {
    /** @type {InitializationManager} */
    static _instance = null;

    /** @type {Map<string, BaseManager>} */
    #managers = null;

    /** @type {LoadingManager} */
    #loadingManager = null;

    /** @type {number} */
    #startTime = null;

    constructor() {
        if (InitializationManager._instance) {
            throw new Error('InitializationManager is a singleton. Use InitializationManager.getInstance() instead.');
        }
        super('InitializationManager');
        
        this.#managers = managers;
        InitializationManager._instance = this;
    }

    /**
     * Get singleton instance
     * @returns {InitializationManager}
     */
    static getInstance() {
        if (!InitializationManager._instance) {
            InitializationManager._instance = new InitializationManager();
        }
        return InitializationManager._instance;
    }

    /**
     * Initialize the initialization manager
     * @returns {Promise<boolean>}
     */
    async initialize(mode = 'startup') {
        if (this.initialized) {
            return true;
        }

        try {
            console.log('[DEBUG] 🚀 Starting initialization...');

            // Ensure ErrorHandler is initialized first
            if (!errorHandler.isInitialized()) {
                await errorHandler.initialize();
            }

            // Initialize LoadingManager first and start loading screen
            if (!loadingManager.isInitialized()) {
                await loadingManager.initialize();
            }
            await loadingManager.startLoading(22); // Total number of managers to initialize

            // Initialize core managers in correct order
            const managers = [
                { instance: errorHandler, name: 'Error Handler' },
                { instance: eventManager, name: 'Event Manager' },
                { instance: loadingManager, name: 'Loading Manager' },
                { instance: connectionManager, name: 'Connection Manager' },
                { instance: cacheManager, name: 'Cache Manager' },
                { instance: uiManager, name: 'UI Manager' },
                { instance: debugManager, name: 'Debug Manager' },
                { instance: themeManager, name: 'Theme Manager' },
                { instance: progressManager, name: 'Progress Manager' },
                { instance: menuManager, name: 'Menu Manager' },
                { instance: languageManager, name: 'Language Manager' },
                { instance: storeManager, name: 'Store Manager' },
                { instance: interfaceManager, name: 'Interface Manager' },
                { instance: dataManager, name: 'Data Manager' },
                { instance: statusManager, name: 'Status Manager' },
                { instance: userManager, name: 'User Manager' },
                { instance: updateManager, name: 'Update Manager' },
                { instance: refreshManager, name: 'Refresh Manager' },
                { instance: rankingManager, name: 'Ranking Manager' },
                { instance: settingsManager, name: 'Settings Manager' },
                { instance: messageManager, name: 'Message Manager' },
                { instance: notificationManager, name: 'Notification Manager' }
            ];

            // Initialize each manager
            for (const [index, { instance, name }] of managers.entries()) {
                try {
                    if (!instance) {
                        console.warn(`[WARNING] ⚠️ Manager ${name} not found`);
                        await loadingManager.updateProgress(index + 1, `${name} (not found)`);
                        continue;
                    }
                    
                    if (instance.isInitialized()) {
                        console.log(`[DEBUG] ⏭️ ${name} already initialized`);
                        await loadingManager.updateProgress(index + 1, `${name} (skipped)`);
                        continue;
                    }

                    console.log(`[DEBUG] 🚀 Initializing ${name}...`);
                    await instance.initialize();
                    await loadingManager.updateProgress(index + 1, name);
                    console.log(`[DEBUG] ✅ ${name} initialized`);
                } catch (error) {
                    console.error(`[ERROR] ❌ Failed to initialize ${name}:`, error);
                    await loadingManager.updateProgress(index + 1, `${name} (error)`);
                    throw error;
                }
            }

            this.initialized = true;
            console.log('[DEBUG] ✅ All managers initialized successfully');
            
            // Finish loading screen
            await loadingManager.finishLoading();
            return true;
        } catch (error) {
            console.error('[ERROR] ❌ Initialization failed:', error);
            if (errorHandler.isInitialized()) {
                errorHandler.handleError(error);
            }
            // Ensure loading screen is hidden even on error
            if (loadingManager.isInitialized()) {
                await loadingManager.finishLoading(true);
            }
            return false;
        }
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
            if (errorHandler.isInitialized()) {
                errorHandler.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH);
            }
            return false;
        }
    }
}

// Export singleton instance
export const initializationManager = InitializationManager.getInstance();