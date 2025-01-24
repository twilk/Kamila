import { BaseManager } from './BaseManager.js';
import { ErrorHandler } from './ErrorHandler.js';
import { LogLevel } from './LogLevel.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LoadingManager } from './LoadingManager.js';
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
        
        // Only log if ErrorHandler exists, don't create new instance
        if (BaseManager._errorHandler) {
            this.log(LogLevel.INFO, '📝 Using existing ErrorHandler instance');
        }
        
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
    async initialize(context = 'startup') {
        try {
            // Check if already initialized
            if (this.isInitialized()) {
                this.log(LogLevel.WARNING, '⚠️ InitializationManager already initialized');
                return true;
            }

            this.#startTime = performance.now();
            this.log(LogLevel.INFO, `🚀 Starting initialization (${context})`);

            // Initialize base functionality
            await super.initialize();

            // Get LoadingManager instance
            this.#loadingManager = LoadingManager.getInstance();

            // Get initialization order
            const initializationOrder = registerManagers();

            // Log registered managers
            this.log(LogLevel.INFO, '\n📝 Registered Managers:', this.#managers);

            // Create initialization plan
            const plan = initializationOrder.map(name => ({
                name,
                type: this.#managers[name]?.constructor.name || 'Unknown',
                status: this.#managers[name]?.isInitialized() ? 'Initialized' : 'Pending',
                dependencies: Array.from(this.#managers[name]?._dependencies || [])
                    .map(dep => dep.name)
                    .join(', ') || 'none'
            }));

            this.log(LogLevel.INFO, '\n📋 Initialization Plan:');
            console.table(plan);

            // Start loading screen with total number of managers
            await this.#loadingManager.startLoading(initializationOrder.length);

            // Track failed managers
            const failedManagers = [];

            // Initialize managers in order
            for (const [index, name] of initializationOrder.entries()) {
                const manager = this.#managers[name];
                
                if (!manager) {
                    failedManagers.push({ name, error: 'Manager not found' });
                    this.#loadingManager.updateProgress(index + 1, `${name} (failed)`);
                    continue;
                }

                if (manager.isInitialized()) {
                    this.log(LogLevel.INFO, `⏭️ Skipping ${name} - already initialized`);
                    this.#loadingManager.updateProgress(index + 1, `${name} (skipped)`);
                    continue;
                }

                try {
                    this.log(LogLevel.INFO, `🚀 Initializing ${name}`);
                    const success = await manager.initialize({ context });
                    
                    if (!success) {
                        failedManagers.push({ name, error: 'Initialization returned false' });
                        this.#loadingManager.updateProgress(index + 1, `${name} (failed)`);
                    } else {
                        this.#loadingManager.updateProgress(index + 1, name);
                    }
                } catch (error) {
                    failedManagers.push({ name, error: error.message });
                    this.#loadingManager.updateProgress(index + 1, `${name} (error)`);
                }
            }

            // Check for failed managers
            if (failedManagers.length > 0) {
                const duration = (performance.now() - this.#startTime).toFixed(2);
                const error = new Error(`Failed to initialize ${failedManagers.length} managers`);
                this.log(LogLevel.ERROR, `❌ Initialization failed after ${duration}ms:`, failedManagers);
                this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                    context,
                    duration,
                    failedManagers
                });

                // Finish loading with error
                await this.#loadingManager.finishLoading(true);
                return false;
            }

            // Log success
            const duration = (performance.now() - this.#startTime).toFixed(2);
            this.log(LogLevel.SUCCESS, `✅ Initialization completed in ${duration}ms`);

            // Finish loading successfully
            await this.#loadingManager.finishLoading();
            return true;

        } catch (error) {
            const duration = (performance.now() - this.#startTime).toFixed(2);
            this.log(LogLevel.ERROR, `❌ Critical initialization error after ${duration}ms:`, error);
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.CRITICAL, {
                context,
                duration
            });

            // Ensure loading screen is hidden even on error
            if (this.#loadingManager) {
                await this.#loadingManager.finishLoading(true);
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
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH);
            return false;
        }
    }
}

// Export singleton instance
export const initializationManager = InitializationManager.getInstance();