import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { operationProgressManager } from './OperationProgressManager.js';

const STATUS_TRANSLATIONS = {
    'initializing': 'Inicjalizacja',
    'configuring': 'Konfiguracja',
    'connecting': 'Połączenie',
    'synchronizing': 'Synchronizacja',
    'loading': 'Ładowanie',
    'preparing': 'Przygotowanie',
    'updating': 'Aktualizacja',
    'finishing': 'Finalizacja'
};

const LOADING_TRANSLATIONS = {
    LOADING_INIT: 'Inicjalizacja',
    LOADING_CONFIG: 'Konfiguracja',
    LOADING_CONNECT: 'Połączenie',
    LOADING_SYNC: 'Synchronizacja'
};

const MANAGER_GROUPS = {
    CORE: 'Core Services',
    BASE: 'Base Managers',
    FEATURE: 'Feature Managers',
    API: 'API Services'
};

/**
 * @typedef {Object} LoadingState
 * @property {string} id - Loading state ID
 * @property {string} message - Loading message
 * @property {number} progress - Progress percentage (0-100)
 * @property {boolean} isBlocking - Whether this state blocks UI
 * @property {number} startTime - Start timestamp
 * @property {number} [endTime] - End timestamp
 * @property {string} [error] - Error message if failed
 */

/**
 * @extends {BaseManager}
 * Manages initial loading screen and progress indicators during app initialization
 */
export class InitialLoadingManager extends BaseManager {
    /** @private */
    static #instance = null;
    /** @private */
    static _registry = null;

    /** @private */
    #container = null;
    /** @private */
    #progressBar = null;
    /** @private */
    #progressLabel = null;
    /** @private */
    #statusText = null;
    /** @private */
    #loadingTime = null;
    /** @private */
    #startTime = null;
    /** @private */
    #totalSteps = 0;
    /** @private */
    #currentStep = 0;
    /** @private */
    #isVisible = false;
    /** @private */
    #minLoadingTime = 1500; // Minimum loading screen display time
    /** @private */
    #translations = LOADING_TRANSLATIONS;
    /** @private */
    #isLoading = false;
    /** @private */
    #loadingText = '';
    /** @private */
    #loadingProgress = 0;
    /** @private */
    #loadingTotal = 0;
    /** @private */
    #progressSteps = null;
    /** @private */
    #wordsLoader = null;
    /** @private */
    #truckLoader = null;
    /** @private */
    #loadingStates = new Map();
    /** @private */
    #loadingPromise = null;
    /** @private */
    #loadingResolve = null;
    /** @private */
    #loadingReject = null;
    /** @private */
    #completedSteps = 0;
    /** @private */
    #progress = 0;
    /** @private */
    #eventManager = null;
    /** @private */
    #total = 0;

    constructor(registry) {
        if (InitialLoadingManager.#instance) {
            return InitialLoadingManager.#instance;
        }
        super(registry, 'LoadingManager');
        InitialLoadingManager.#instance = this;
        InitialLoadingManager._registry = registry;
        
        // Add dependencies
        this.addDependency('event');
    }

    static getInstance() {
        if (!InitialLoadingManager.#instance && InitialLoadingManager._registry) {
            InitialLoadingManager.#instance = new InitialLoadingManager(InitialLoadingManager._registry);
        }
        return InitialLoadingManager.#instance;
    }

    static setRegistry(registry) {
        if (!registry) {
            throw new Error('Registry is required');
        }
        InitialLoadingManager._registry = registry;
    }

    /**
     * Initialize loading manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing loading manager...');
            
            // Start loading sequence
            await this.startLoading(10); // Set total steps based on number of critical managers
            
            // Show initial loading message
            this.updateProgress(1, 'Initializing core services...');
            
            // Get required dependencies
            const [eventManager, storageManager] = await Promise.all([
                this.getDependency('event'),
                this.getDependency('storage')
            ]);

            // Validate required dependencies
            if (!eventManager?.isInitialized()) {
                throw new Error('EventManager must be initialized');
            }
            if (!storageManager?.isInitialized()) {
                throw new Error('StorageManager must be initialized');
            }

            // Update progress for core services
            this.updateProgress(2, 'Core services initialized');

            // Initialize UI components
            this.updateProgress(3, 'Loading UI components...');
            
            // Initialize data layer
            this.updateProgress(5, 'Loading data layer...');
            
            // Initialize features
            this.updateProgress(7, 'Loading features...');
            
            // Final checks
            this.updateProgress(9, 'Performing final checks...');
            
            // Complete loading
            await this.finishLoading();
            
            this.log(LogLevel.SUCCESS, '✅ Loading manager initialized');
            return true;
        } catch (error) {
            await this.finishLoading(true); // Show error state
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Start loading sequence
     * @param {number} totalSteps Total number of loading steps
     */
    async startLoading(totalSteps) {
        try {
            this.#total = totalSteps;
            this.#progress = 0;
            this.#isVisible = true;
            
            // Create or update loading UI
            const loadingElement = document.querySelector('.loading-container') || this.#createLoadingElement();
            loadingElement.style.display = 'flex';
            
            // Initialize progress bar
            const progressBar = loadingElement.querySelector('.progress-bar');
            const progressText = loadingElement.querySelector('.progress-text');
            
            if (progressBar) {
                progressBar.style.width = '0%';
                progressBar.setAttribute('aria-valuenow', '0');
            }
            
            if (progressText) {
                progressText.textContent = 'Starting initialization...';
            }
            
            this.log(LogLevel.INFO, '🚀 Started loading sequence', { totalSteps });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM);
        }
    }

    /**
     * Update loading progress
     * @param {number} step Current step
     * @param {string} status Status message
     */
    async updateProgress(step, status = '') {
        try {
            this.#progress = step;
            const percentage = Math.round((step / this.#total) * 100);
            
            const loadingElement = document.querySelector('.loading-container');
            if (!loadingElement) return;
            
            const progressBar = loadingElement.querySelector('.progress-bar');
            const progressText = loadingElement.querySelector('.progress-text');
            
            if (progressBar) {
                progressBar.style.width = `${percentage}%`;
                progressBar.setAttribute('aria-valuenow', percentage.toString());
            }
            
            if (progressText && status) {
                progressText.textContent = status;
            }
            
            this.log(LogLevel.DEBUG, `📊 Loading progress: ${percentage}%`, { step, status });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW);
        }
    }

    /**
     * Finish loading sequence
     * @param {boolean} isError Whether loading failed
     */
    async finishLoading(isError = false) {
        try {
            const loadingElement = document.querySelector('.loading-container');
            if (!loadingElement) return;
            
            const progressBar = loadingElement.querySelector('.progress-bar');
            const progressText = loadingElement.querySelector('.progress-text');
            
            if (progressBar) {
                progressBar.style.width = '100%';
                progressBar.classList.toggle('error', isError);
            }
            
            if (progressText) {
                progressText.textContent = isError ? 'Failed to initialize' : 'Initialization complete';
            }
            
            // Fade out loading screen
            loadingElement.style.opacity = '0';
            await new Promise(resolve => setTimeout(resolve, 500));
            loadingElement.style.display = 'none';
            
            this.#isVisible = false;
            this.log(LogLevel.INFO, isError ? '❌ Loading failed' : '✅ Loading complete');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW);
        }
    }

    /**
     * Create loading UI element
     * @private
     */
    #createLoadingElement() {
        const element = document.createElement('div');
        element.className = 'loading-container';
        element.innerHTML = `
            <div class="loading-content">
                <div class="loading-icon">
                    <div class="truck-container">
                        <div class="truck">
                            <div class="truck-body"></div>
                            <div class="truck-cabin"></div>
                            <div class="wheel"></div>
                            <div class="wheel"></div>
                        </div>
                    </div>
                </div>
                <div class="progress">
                    <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
                <div class="progress-text">Starting initialization...</div>
            </div>
        `;
        document.body.appendChild(element);
        return element;
    }

    /**
     * Create truck loader element
     * @private
     * @returns {HTMLElement}
     */
    #createTruckLoader() {
        const truckLoader = document.createElement('div');
        truckLoader.className = 'loaderTruck';
        truckLoader.innerHTML = `
            <div class="truckWrapper">
                <div class="truckBody">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 198 93" class="trucksvg">
                        <path stroke-width="3" stroke="#282828" fill="#F83D3D" d="M135 22.5H177.264C178.295 22.5 179.22 23.133 179.594 24.0939L192.33 56.8443C192.442 57.1332 192.5 57.4404 192.5 57.7504V89C192.5 90.3807 191.381 91.5 190 91.5H135C133.619 91.5 132.5 90.3807 132.5 89V25C132.5 23.6193 133.619 22.5 135 22.5Z"></path>
                        <path stroke-width="3" stroke="#282828" fill="#7D7C7C" d="M146 33.5H181.741C182.779 33.5 183.709 34.1415 184.078 35.112L190.538 52.112C191.16 53.748 189.951 55.5 188.201 55.5H146C144.619 55.5 143.5 54.3807 143.5 53V36C143.5 34.6193 144.619 33.5 146 33.5Z"></path>
                        <rect stroke-width="3" stroke="#282828" fill="#FFFFFF" rx="2.5" height="90" width="121" y="1.5" x="6.5"></rect>
                        <rect stroke-width="2" stroke="#282828" fill="#DFDFDF" rx="2" height="4" width="6" y="84" x="1"></rect>
                    </svg>
                </div>
                <div class="truckTires">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 30 30" class="tiresvg">
                        <circle stroke-width="3" stroke="#282828" fill="#282828" r="13.5" cy="15" cx="15"></circle>
                        <circle fill="#DFDFDF" r="7" cy="15" cx="15"></circle>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 30 30" class="tiresvg">
                        <circle stroke-width="3" stroke="#282828" fill="#282828" r="13.5" cy="15" cx="15"></circle>
                        <circle fill="#DFDFDF" r="7" cy="15" cx="15"></circle>
                    </svg>
                </div>
                <div class="road"></div>
            </div>
        `;
        return truckLoader;
    }

    /**
     * Create progress steps indicators
     * @private
     */
    #createProgressSteps() {
        if (!this.#progressSteps) return;
        
        // Always create at least one step
        const totalSteps = Math.max(1, this.#totalSteps);
        
        this.#progressSteps.innerHTML = '';
        for (let i = 0; i < totalSteps; i++) {
            const step = document.createElement('div');
            step.className = 'step';
            if (i < this.#currentStep) {
                step.classList.add('completed');
            }
            this.#progressSteps.appendChild(step);
        }
    }

    /**
     * Create progress bar element
     * @private
     * @returns {HTMLElement}
     */
    #createProgressBar() {
        const progressBar = document.createElement('div');
        progressBar.className = 'loaderBar';
        progressBar.innerHTML = `
            <span class="loader-text">0%</span>
            <span class="load"></span>
            <div class="progress-steps"></div>
        `;
        return progressBar;
    }

    /**
     * Create words loader element
     * @private
     * @returns {HTMLElement}
     */
    #createWordsLoader() {
        const wordsLoader = document.createElement('div');
        wordsLoader.className = 'loaderWords';
        wordsLoader.innerHTML = `
            <div class="words">
                <span class="word">Inicjalizacja...</span>
            </div>
        `;
        return wordsLoader;
    }

    /**
     * Clean up resources
     * @protected
     */
    async _dispose() {
        try {
            this.log(LogLevel.INFO, '🔄 Disposing loading manager...');
            
            // Clear all loading states
            this.#loadingStates.clear();
            this.#completedSteps = 0;
            this.#totalSteps = 0;
            this.#isLoading = false;
            
            // Clear UI elements
            this.#container = null;
            this.#progressBar = null;
            this.#progressLabel = null;
            this.#statusText = null;
            this.#wordsLoader = null;
            this.#truckLoader = null;
            
            // Clear loading promise
            this.#loadingPromise = null;
            this.#loadingResolve = null;
            this.#loadingReject = null;
            
            // Unsubscribe from events
            if (this.#eventManager?.isInitialized()) {
                await this.#eventManager.off('loading:start');
                await this.#eventManager.off('loading:end');
                await this.#eventManager.off('manager:initializing');
                await this.#eventManager.off('manager:initialized');
                await this.#eventManager.off('manager:failed');
            }
            
            await super.dispose();
            this.log(LogLevel.SUCCESS, '✅ Loading manager disposed');
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.MEDIUM, {
                method: '_dispose'
            });
        }
    }

    /**
     * Handle error with retry logic
     * @private
     */
    async #handleError(error, type, severity, context = {}) {
        try {
            const errorHandler = await this.getDependency('error');
            if (errorHandler?.isInitialized()) {
                await errorHandler.handle(error, type, severity, {
                    manager: 'LoadingManager',
                    ...context
                });
            } else {
                console.error('[LoadingManager] Error:', error);
            }
        } catch (handlingError) {
            console.error('[LoadingManager] Failed to handle error:', handlingError);
            console.error('Original error:', error);
        }
    }

    /** @private */
    #handleLoadingStart(event) {
        const { id, total } = event.data;
        this.#loadingStates.set(id, { current: 0, total });
        this.#updateProgress();
    }
    
    /** @private */
    #handleLoadingEnd(event) {
        const { id } = event.data;
        this.#loadingStates.delete(id);
        this.#updateProgress();
    }
    
    /** @private */
    #updateProgress() {
        const total = Array.from(this.#loadingStates.values())
            .reduce((sum, state) => sum + state.total, 0);
        const current = Array.from(this.#loadingStates.values())
            .reduce((sum, state) => sum + state.current, 0);
        
        this.#progress = total > 0 ? (current / total) * 100 : 0;
    }
}

// Export instance only
export const loadingManager = InitialLoadingManager.getInstance(); 