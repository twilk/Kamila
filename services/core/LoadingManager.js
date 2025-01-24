import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';

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
 * Manages loading screen and progress indicators
 */
export class LoadingManager extends BaseManager {
    static _instance = null;

    static getInstance() {
        if (!LoadingManager._instance) {
            LoadingManager._instance = new LoadingManager();
        }
        return LoadingManager._instance;
    }

    constructor() {
        super('LoadingManager');
        if (LoadingManager._instance) {
            throw new Error('Use LoadingManager.getInstance()');
        }

        this._container = null;
        this._progressBar = null;
        this._progressLabel = null;
        this._statusText = null;
        this._loadingTime = null;
        this._startTime = null;
        this._totalSteps = 0;
        this._currentStep = 0;
        this._isVisible = false;
        this._minLoadingTime = 1500; // Minimum loading screen display time
        this._translations = LOADING_TRANSLATIONS; // Initialize translations
    }

    /**
     * Initialize loading manager
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            await super.initialize();
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            await this._createLoadingScreen();
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
    async _createLoadingScreen() {
        try {
            const container = document.querySelector('.loading-container');
            if (!container) {
                throw new Error('Loading container not found in popup.html');
            }

            // Create main structure
            const loaderContainer = document.createElement('div');
            loaderContainer.className = 'loader-container';

            // 1. Create Truck Loader
            const truckLoader = this._createTruckLoader();
            
            // 2. Create Progress Bar
            const progressBar = this._createProgressBar();
            
            // 3. Create Words Loader
            const wordsLoader = this._createWordsLoader();

            // Add all loaders to container
            loaderContainer.appendChild(truckLoader);
            loaderContainer.appendChild(progressBar);
            loaderContainer.appendChild(wordsLoader);
            
            // Clear and add new content
            container.innerHTML = '';
            container.appendChild(loaderContainer);

            // Store references
            this._container = container;
            this._progressBar = progressBar.querySelector('.load');
            this._progressLabel = progressBar.querySelector('.loader-text');
            this._progressSteps = progressBar.querySelector('.progress-steps');
            this._wordsLoader = wordsLoader;
            this._truckLoader = truckLoader;

            // Initialize progress steps
            this._createProgressSteps();

            // Ensure proper classes
            container.classList.remove('d-none', 'fade-out');
            container.style.display = 'flex';
            container.style.opacity = '1';

            return container;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.HIGH, {
                method: '_createLoadingScreen'
            });
        }
    }

    /**
     * Create truck loader element
     * @private
     * @returns {HTMLElement}
     */
    _createTruckLoader() {
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
    _createProgressSteps() {
        if (!this._progressSteps || !this._totalSteps) return;
        
        this._progressSteps.innerHTML = '';
        for (let i = 0; i < this._totalSteps; i++) {
            const step = document.createElement('div');
            step.className = 'step';
            if (i < this._currentStep) {
                step.classList.add('completed');
            }
            this._progressSteps.appendChild(step);
        }
    }

    /**
     * Create progress bar element
     * @private
     * @returns {HTMLElement}
     */
    _createProgressBar() {
        const progressBar = document.createElement('div');
        progressBar.className = 'loaderBar';
        progressBar.innerHTML = `
            <span class="loader-text">0%</span>
            <span class="load d-none"></span>
            <div class="progress-steps"></div>
        `;
        return progressBar;
    }

    /**
     * Create words loader element
     * @private
     * @returns {HTMLElement}
     */
    _createWordsLoader() {
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
            this.log(LogLevel.INFO, '🎬 Opening loading screen', {
                totalSteps,
                currentStep: 0,
                startTime: new Date().toISOString()
            });
            
            // Ensure initialization
            if (!this._initialized) {
                await this.initialize();
            }

            // Reset state
            this._totalSteps = totalSteps;
            this._currentStep = 0;
            this._startTime = performance.now();
            this._isVisible = true;

            // Show loading screen
            if (this._container) {
                this._container.style.display = 'flex';
                this._container.style.opacity = '1';
                this._container.classList.remove('d-none', 'fade-out');
            }

        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.HIGH, {
                method: 'startLoading',
                totalSteps
            });
        }
    }

    /**
     * Update loading progress
     * @param {number} step Current step number
     * @param {string} description Current step description
     */
    updateProgress(step, description) {
        if (!this._container || !this._isVisible) return;
        
        this._currentStep = step;
        
        // Calculate progress percentage
        const progress = Math.min(100, Math.round((step / this._totalSteps) * 100));
        
        // Update progress bar and label
        if (this._progressBar && this._progressLabel) {
            this._progressBar.style.width = `${progress}%`;
            this._progressLabel.textContent = `${progress}%`;
        }

        // Update progress steps
        this._createProgressSteps();
        
        // Update words loader text with current manager name
        if (this._wordsLoader && description) {
            const managerName = description.includes('Manager') ? 
                description.split(' ')[0] : // Extract manager name if present
                description;
                
            const words = this._wordsLoader.querySelector('.words');
            if (words) {
                // Keep only one word visible
                words.innerHTML = `
                    <span class="word">${managerName}</span>
                `;
            }
        }
        
        // Update loading time
        if (this._startTime) {
            const currentTime = performance.now() - this._startTime;
            const timeText = `${currentTime.toFixed(2)}ms`;
            if (!this._loadingTime) {
                this._loadingTime = document.createElement('div');
                this._loadingTime.className = 'loading-time';
                this._container.appendChild(this._loadingTime);
            }
            this._loadingTime.textContent = timeText;
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
     * @param {boolean} hasError Whether there was an error during initialization
     */
    async finishLoading(hasError = false) {
        try {
            const duration = this._startTime ? `${(performance.now() - this._startTime).toFixed(2)}ms` : 'unknown';
            this.log(LogLevel.INFO, '🏁 Starting to close loading screen', {
                totalSteps: this._totalSteps,
                completedSteps: this._currentStep,
                duration,
                hasError
            });

            if (!this._container || !this._isVisible) {
                this.log(LogLevel.WARN, '⚠️ Container already removed or not visible');
                return;
            }

            // 1. Wait for minimum loading time
            const currentTime = performance.now();
            const elapsedTime = currentTime - this._startTime;
            if (elapsedTime < this._minLoadingTime) {
                await new Promise(resolve => setTimeout(resolve, this._minLoadingTime - elapsedTime));
            }

            // 2. If there was no error, wait for all managers to initialize
            if (!hasError) {
                await new Promise((resolve) => {
                    const checkInitialization = () => {
                        if (this._currentStep >= this._totalSteps) {
                            resolve();
                        } else {
                            setTimeout(checkInitialization, 100);
                        }
                    };
                    checkInitialization();
                });
            }

            // 3. Add fade-out class and wait for animation
            this._container.classList.add('fade-out');
            
            await new Promise(resolve => {
                const onTransitionEnd = () => {
                    this._container.style.display = 'none';
                    this._isVisible = false;
                    
                    // Show main application container
                    const mainContainer = document.querySelector('.container-fluid');
                    if (mainContainer) {
                        mainContainer.classList.remove('d-none');
                        mainContainer.style.opacity = '1';
                    }
                    
                    resolve();
                };
                
                this._container.addEventListener('transitionend', onTransitionEnd, { once: true });
                
                // Backup timeout
                setTimeout(() => {
                    this._container.removeEventListener('transitionend', onTransitionEnd);
                    this._container.style.display = 'none';
                    this._isVisible = false;
                    
                    // Show main application container
                    const mainContainer = document.querySelector('.container-fluid');
                    if (mainContainer) {
                        mainContainer.classList.remove('d-none');
                        mainContainer.style.opacity = '1';
                    }
                    
                    resolve();
                }, 500);
            });

            // 4. Clean up
            this.log(LogLevel.DEBUG, '🧹 Cleaning up references');
            this._container = null;
            this._progressBar = null;
            this._progressLabel = null;
            this._statusText = null;
            this._loadingTime = null;
            this._currentStep = 0;
            this._totalSteps = 0;
            this._startTime = null;

            this.log(LogLevel.SUCCESS, '✨ Loading screen closed successfully');
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Error during finishLoading', {
                error: error.message,
                stack: error.stack
            });

            // Emergency cleanup
            if (this._container) {
                this._container.style.display = 'none';
                this._isVisible = false;
            }
            
            // Show main application container even on error
            const mainContainer = document.querySelector('.container-fluid');
            if (mainContainer) {
                mainContainer.classList.remove('d-none');
                mainContainer.style.opacity = '1';
            }
            
            this._container = null;
            this._progressBar = null;
            this._progressLabel = null;
            this._statusText = null;
            this._loadingTime = null;
        }
    }

    /**
     * Cleanup and dispose
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            if (this._container) {
                this._container.style.display = 'none';
                this._isVisible = false;
            }
            this._container = null;
            this._progressBar = null;
            this._progressLabel = null;
            this._statusText = null;
            this._loadingTime = null;
            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
        }
    }
}

// Export singleton instance
export const loadingManager = LoadingManager.getInstance(); 