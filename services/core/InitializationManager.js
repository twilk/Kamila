import { BaseManager } from './BaseManager.js';
import { ErrorHandler } from './ErrorHandler.js';
import { LogLevel } from './LogLevel.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { InitialLoadingManager } from './LoadingManager.js';
import { EventManager } from './EventManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { CacheManager } from './CacheManager.js';
import { UIManager } from './UIManager.js';
import { DebugManager } from './DebugManager.js';
import { ThemeManager } from './ThemeManager.js';
import { OperationProgressManager } from './OperationProgressManager.js';
import { MenuManager } from './MenuManager.js';
import { LanguageManager } from './LanguageManager.js';
import { StoreManager } from './StoreManager.js';
import { InterfaceManager } from './InterfaceManager.js';
import { DataManager } from './DataManager.js';
import { UserManager } from './UserManager.js';
import { UpdateManager } from './UpdateManager.js';
import { RefreshManager } from './RefreshManager.js';
import { RankingManager } from './RankingManager.js';
import { SettingsManager } from './SettingsManager.js';
import { MessageManager } from './MessageManager.js';
import { NotificationManager } from './NotificationManager.js';
import { VolumeManager } from './VolumeManager.js';
import { StatusManager } from './StatusManager.js';

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
                const errorHandler = ErrorHandler.getInstance();
                if (!errorHandler.isReady()) {
                    await errorHandler.initialize();
                }

                // Initialize InitialLoadingManager first
                this.#loadingManager = InitialLoadingManager.getInstance();
                if (!this.#loadingManager.isInitialized()) {
                    await this.#loadingManager.initialize();
                }
                await this.#loadingManager.startLoading(22); // Total number of managers to initialize

                // Initialize core managers in correct order
                const managersToInitialize = [
                    { instance: ErrorHandler.getInstance(), name: 'Error Handler' },
                    { instance: EventManager.getInstance(), name: 'Event Manager' },
                    { instance: ConnectionManager.getInstance(), name: 'Connection Manager' },
                    { instance: CacheManager.getInstance(), name: 'Cache Manager' },
                    { instance: UIManager.getInstance(), name: 'UI Manager' },
                    { instance: ThemeManager.getInstance(), name: 'Theme Manager' },
                    { instance: DebugManager.getInstance(), name: 'Debug Manager' },
                    { instance: VolumeManager.getInstance(), name: 'Volume Manager' },
                    { instance: OperationProgressManager.getInstance(), name: 'Operation Progress Manager' },
                    { instance: StoreManager.getInstance(), name: 'Store Manager' },
                    { instance: MenuManager.getInstance(), name: 'Menu Manager' },
                    { instance: LanguageManager.getInstance(), name: 'Language Manager' },
                    { instance: InterfaceManager.getInstance(), name: 'Interface Manager' },
                    { instance: DataManager.getInstance(), name: 'Data Manager' },
                    { instance: StatusManager.getInstance(), name: 'Status Manager' },
                    { instance: UserManager.getInstance(), name: 'User Manager' },
                    { instance: NotificationManager.getInstance(), name: 'Notification Manager' },
                    { instance: UpdateManager.getInstance(), name: 'Update Manager' },
                    { instance: RefreshManager.getInstance(), name: 'Refresh Manager' },
                    { instance: RankingManager.getInstance(), name: 'Ranking Manager' },
                    { instance: SettingsManager.getInstance(), name: 'Settings Manager' },
                    { instance: MessageManager.getInstance(), name: 'Message Manager' }
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
                const errorHandler = ErrorHandler.getInstance();
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
            const errorHandler = ErrorHandler.getInstance();
            if (errorHandler.isReady()) {
                errorHandler.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH);
            }
            return false;
        }
    }
}

// Export only the instance
export const initializationManager = InitializationManager.getInstance();