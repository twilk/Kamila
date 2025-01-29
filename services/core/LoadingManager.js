import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { progressManager } from './ProgressManager.js';

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
 * @extends {BaseManager}
 * Manages initial loading screen and progress indicators during app initialization
 */
export class InitialLoadingManager extends BaseManager {
    static _instance = null;

    // Private fields
    #container = null;
    #progressBar = null;
    #progressLabel = null;
    #statusText = null;
    #loadingTime = null;
    #startTime = null;
    #totalSteps = 0;
    #currentStep = 0;
    #isVisible = false;
    #minLoadingTime = 1500; // Minimum loading screen display time
    #translations = LOADING_TRANSLATIONS;
    #isLoading = false;
    #loadingText = '';
    #loadingProgress = 0;
    #loadingTotal = 0;
    #progressSteps = null;
    #wordsLoader = null;
    #truckLoader = null;

    static getInstance() {
        if (!InitialLoadingManager._instance) {
            InitialLoadingManager._instance = new InitialLoadingManager();
        }
        return InitialLoadingManager._instance;
    }

    constructor() {
        super('InitialLoadingManager');
        if (InitialLoadingManager._instance) {
            throw new Error('Use InitialLoadingManager.getInstance()');
        }
        // Add dependency on ProgressManager
        this.addDependency(progressManager);
    }

    /**
     * Initialize loading manager
     * @returns {Promise<void>}
     */
    async onInitialize() {
        try {
            // Initialize loading state
            this.#isLoading = false;
            this.#loadingText = '';
            this.#loadingProgress = 0;
            this.#loadingTotal = 0;

            // Initialize loading UI
            await this.#createLoadingScreen();

            // Initialize progress manager
            await progressManager.initialize();

            this.log(LogLevel.SUCCESS, '⚡ Loading manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
    }

    /**
     * Create loading screen elements
     * @private
     */
    async #createLoadingScreen() {
        try {
            const container = document.querySelector('.loading-container');
            if (!container) {
                throw new Error('Loading container not found in popup.html');
            }

            // Create main structure
            const loaderContainer = document.createElement('div');
            loaderContainer.className = 'loader-container';

            // 1. Create Truck Loader
            const truckLoader = this.#createTruckLoader();
            
            // 2. Create Progress Bar
            const progressBar = this.#createProgressBar();
            
            // 3. Create Words Loader
            const wordsLoader = this.#createWordsLoader();

            // Add all loaders to container
            loaderContainer.appendChild(truckLoader);
            loaderContainer.appendChild(progressBar);
            loaderContainer.appendChild(wordsLoader);
            
            // Clear and add new content
            container.innerHTML = '';
            container.appendChild(loaderContainer);

            // Store references
            this.#container = container;
            this.#progressBar = progressBar.querySelector('.load');
            this.#progressLabel = progressBar.querySelector('.loader-text');
            this.#progressSteps = progressBar.querySelector('.progress-steps');
            this.#wordsLoader = wordsLoader;
            this.#truckLoader = truckLoader;

            // Initialize progress steps
            this.#createProgressSteps();

            // Ensure proper classes
            container.classList.remove('d-none', 'fade-out');
            container.style.display = 'flex';
            container.style.opacity = '1';

            return container;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.HIGH, {
                method: '#createLoadingScreen'
            });
        }
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
     * Start loading screen with specified number of steps
     * @param {number} totalSteps Number of loading steps
     */
    async startLoading(totalSteps) {
        try {
            if (this.#isVisible) {
                this.log(LogLevel.WARN, '⚠️ Loading screen already visible');
                return;
            }

            this.#isVisible = true;
            this.#startTime = performance.now();
            this.#totalSteps = totalSteps;
            this.#currentStep = 0;

            // Show loading screen with fade-in animation
            if (this.#container) {
                this.#container.classList.remove('hidden', 'fade-out');
                this.#container.classList.add('fade-in');
                this.log(LogLevel.INFO, '🎬 Opening loading screen');
                this.emit('loading:start', { totalSteps });
            }

            // Start progress tracking
            progressManager.startTask('Inicjalizacja aplikacji', totalSteps);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'startLoading',
                totalSteps
            });
        }
    }

    /**
     * Update loading progress
     * @param {number} step Current step
     * @param {string} status Status message
     */
    async updateProgress(step, status = '') {
        try {
            if (!this.#isVisible || !this.#container) return;

            this.#currentStep = Math.min(step, this.#totalSteps);
            const percentage = Math.max(0, Math.min(100, (this.#currentStep / Math.max(1, this.#totalSteps)) * 100));

            // Update progress bar
            if (this.#progressBar) {
                this.#progressBar.classList.remove('d-none');
                this.#progressBar.style.width = `${percentage}%`;
                this.#progressBar.setAttribute('aria-valuenow', percentage);
            }

            // Update status text
            if (this.#statusText) {
                this.#statusText.textContent = status;
            }

            // Update percentage text
            if (this.#progressLabel) {
                this.#progressLabel.textContent = `${Math.round(percentage)}%`;
            }

            // Update progress steps
            this.#createProgressSteps();

            // Update progress manager
            progressManager.updateTask(1, status);

            this.emit('loading:progress', { 
                step, 
                totalSteps: this.#totalSteps, 
                percentage, 
                status 
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'updateProgress',
                step,
                status
            });
        }
    }

    /**
     * Get translated status word based on description
     * @private
     * @param {string} description
     * @returns {string}
     */
    _getCurrentStatusWord(description) {
        // Extract status from description
        const status = Object.keys(STATUS_TRANSLATIONS).find(key => 
            description.toLowerCase().includes(key)
        );
        
        return STATUS_TRANSLATIONS[status] || STATUS_TRANSLATIONS['loading'];
    }

    /**
     * Finish loading and hide loading screen
     * @param {boolean} isError Whether there was an error during initialization
     */
    async finishLoading(isError = false) {
        try {
            if (!this.#isVisible) {
                this.log(LogLevel.WARN, '⚠️ Loading screen already closed');
                return;
            }

            // Calculate remaining minimum time
            const currentTime = performance.now();
            const elapsedTime = currentTime - this.#startTime;
            const remainingTime = Math.max(0, this.#minLoadingTime - elapsedTime);

            if (remainingTime > 0) {
                this.log(LogLevel.INFO, `⏳ Waiting for minimum loading time: ${remainingTime}ms`);
                await new Promise(resolve => setTimeout(resolve, remainingTime));
            }

            // Update final state
            if (this.#progressBar) {
                this.#progressBar.style.width = '100%';
                this.#progressBar.setAttribute('aria-valuenow', 100);
                this.#progressBar.classList.add(isError ? 'error' : 'success');
            }

            // Update progress manager
            if (isError) {
                progressManager.setError('Błąd inicjalizacji');
            } else {
                progressManager.setSuccess('Inicjalizacja zakończona');
            }

            // Start fade-out animation
            if (this.#container) {
                this.#container.classList.remove('fade-in');
                this.#container.classList.add('fade-out');

                // Wait for animation to complete
                await new Promise((resolve) => {
                    const onTransitionEnd = () => {
                        this.#container.removeEventListener('transitionend', onTransitionEnd);
                        this.#container.classList.add('hidden');
                        this.#container.style.display = 'none'; // Force hide
                        resolve();
                    };
                    
                    this.#container.addEventListener('transitionend', onTransitionEnd, { once: true });
                    
                    // Fallback if animation doesn't complete
                    setTimeout(() => {
                        this.#container.removeEventListener('transitionend', onTransitionEnd);
                        this.#container.classList.add('hidden');
                        this.#container.style.display = 'none'; // Force hide
                        resolve();
                    }, 500);
                });

                // Reset state
                this.#cleanup();
                this.emit('loading:finish', { isError });
                this.log(LogLevel.SUCCESS, '✨ Loading screen closed successfully');
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'finishLoading',
                isError
            });
            // Force cleanup even on error
            this.#cleanup();
            if (this.#container) {
                this.#container.style.display = 'none';
                this.#container.classList.add('hidden');
            }
        }
    }

    /**
     * Clean up loading screen state
     * @private
     */
    #cleanup() {
        this.#isVisible = false;
        this.#startTime = null;
        this.#currentStep = 0;
        this.#totalSteps = 0;
        
        if (this.#container) {
            this.#container.style.opacity = '0';
            this.#container.style.display = 'none';
        }
        
        if (this.#progressBar) {
            this.#progressBar.style.width = '0%';
            this.#progressBar.setAttribute('aria-valuenow', 0);
            this.#progressBar.classList.remove('success', 'error');
        }
        
        if (this.#statusText) {
            this.#statusText.textContent = '';
        }
        
        if (this.#progressLabel) {
            this.#progressLabel.textContent = '0%';
        }
    }

    /**
     * Cleanup and dispose
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            if (this.#container) {
                this.#container.style.display = 'none';
                this.#isVisible = false;
            }
            this.#container = null;
            this.#progressBar = null;
            this.#progressLabel = null;
            this.#statusText = null;
            this.#loadingTime = null;

            // Hide progress manager
            progressManager.hide();

            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
        }
    }
}

// Export singleton instance
export const loadingManager = InitialLoadingManager.getInstance(); 