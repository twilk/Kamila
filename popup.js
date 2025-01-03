import { logService } from './services/LogService.js';
import { darwinaService } from './services/DarwinaService.js';
import { userCardService } from './services/UserCardService.js';
import { loadingService } from './services/LoadingService.js';
import { i18nService } from './services/I18nService.js';
import { themeService } from './services/ThemeService.js';
import { uiComponentService } from './services/UIComponentService.js';
import { notificationService } from './services/NotificationService.js';
import { statusCheckerService } from './services/StatusCheckerService.js';
import { updateManagerService } from './services/UpdateManagerService.js';
import { performanceMonitorService } from './services/PerformanceMonitorService.js';
import { stores } from './config/stores.js';
import { storeService } from './services/StoreService.js';
import { hud } from './components/HUD.js';

// Initialize services
async function initializeServices() {
    try {
        logService.info('Initializing application...');

        // Initialize core infrastructure services first
        await Promise.all([
            loadingService.initialize(),
            i18nService.initialize(),
            themeService.initialize()
        ]);
        logService.info('Core infrastructure services initialized');

        // Initialize store service before Darwina service
        await storeService.initialize();
        logService.info('Store service initialized');

        // Initialize Darwina service
        await darwinaService.initialize();
        logService.info('Darwina service initialized');

        // Initialize UI components
        await uiComponentService.initialize();
        logService.info('UI components initialized');

        // Initialize remaining business logic services
        await Promise.all([
            userCardService.initialize(),
            notificationService.initialize()
        ]).catch(error => {
            logService.error('Failed to initialize business services:', error);
            // Don't throw here - continue with limited functionality
        });
        logService.info('Business logic services initialized');

        // Initialize management services - these can fail gracefully
        await Promise.allSettled([
            statusCheckerService.initialize(),
            updateManagerService.initialize(),
            performanceMonitorService.initialize()
        ]).then(results => {
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    logService.error(`Management service ${index} failed:`, result.reason);
                }
            });
        });
        logService.info('Management services initialized');

        // Initialize UI elements
        initializeLanguageSwitcher();
        initializeStoreSelector();
        initializeUserSettings();

        // In development mode, skip auth check and load data directly
        if (darwinaService.devBypassAuth) {
            logService.info('Development mode: Skipping authentication check');
            await loadInitialData();
                    } else {
            // Check authentication state
            const isAuthenticated = await darwinaService.checkAuthorization();
            if (!isAuthenticated) {
                logService.info('Application initialized in unauthenticated state');
                showLoginPrompt();
            } else {
                logService.info('Application initialized successfully');
                await loadInitialData();
            }
        }

    } catch (error) {
        logService.error('Failed to initialize application:', error);
        throw error;
    }
}

function initializeLanguageSwitcher() {
    try {
        const languageSwitcher = document.getElementById('language-switcher');
        if (!languageSwitcher) {
            logService.warn('Language switcher not found');
        return;
    }

        // Find all language flags
        const flags = languageSwitcher.querySelectorAll('.flag');
        
        // Set current language
        const currentLang = i18nService.getCurrentLanguage();
        logService.debug('Current language:', currentLang);
        
        // Update flags state
        flags.forEach(flag => {
            const lang = flag.getAttribute('data-lang');
            
            // Map data-lang values to i18n language codes
            const langMap = {
                'polish': 'polish',
                'english': 'english',
                'ukrainian': 'ukrainian'
            };
            
            // Check if this flag represents current language
            const isCurrentLang = langMap[lang] === currentLang;
            if (isCurrentLang) {
                flag.classList.add('active');
            } else {
                flag.classList.remove('active');
            }
            
            flag.addEventListener('click', async () => {
                try {
                    const newLang = langMap[lang];
                    if (newLang && newLang !== currentLang) {
                        logService.debug('Changing language:', {
                            from: currentLang,
                            to: newLang,
                            mappedFrom: lang
                        });
                        
                        await i18nService.setLanguage(newLang);
                        
                        // Update active state of all flags
                        flags.forEach(f => {
                            if (f.getAttribute('data-lang') === lang) {
                                f.classList.add('active');
                            } else {
                                f.classList.remove('active');
                            }
                        });
                        
                        // Update interface with new translations
                        updateInterface();
                        
                        notificationService.showSuccess(i18nService.translate('notifications.languageChanged'));
                    }
                } catch (error) {
                    logService.error('Failed to change language:', {
                        error: error.message,
                        stack: error.stack,
                        targetLang: lang,
                        currentLang
                    });
                    notificationService.showError(i18nService.translate('notifications.errorLanguageChange'));
                }
            });
        });
    } catch (error) {
        logService.error('Failed to initialize language switcher:', {
            error: error.message,
            stack: error.stack
        });
    }
}

// Handle store selection change
async function handleStoreChange(storeSelect, newStore) {
    if (!newStore) return; // Skip empty selections
    
    try {
        // Disable select during update
        storeSelect.disabled = true;
        loadingService.show();

        const previousStore = await storeService.getCurrentStore();
        
        logService.debug('Store selection change initiated:', {
            newStore,
            previousStore
        });
        
        // Save selected store using StoreService
        await storeService.setCurrentStore(newStore);
        
        // Force refresh data for new store
        const data = await darwinaService.getData(true);
        
        // Update UI with data
        if (data.drwn) {
                    const drwnTable = document.getElementById('drwn-data');
            uiComponentService.renderDRWNTable(data.drwn, drwnTable);
        }
        
        // Update counters with fresh data
        updateCounters(data);
        
        // Show success notification
        notificationService.showSuccess(i18nService.translate('dataRefreshed'));
        logService.info(`Store changed to: ${newStore}`);
        
        // Log final state
        logService.debug('Store change completed:', {
            store: newStore,
            previousStore,
            hasOrders: Array.isArray(data.orders),
            ordersCount: data.orders?.length,
            counters: {
                submitted: data.submitted,
                confirmed: data.confirmed,
                accepted: data.accepted,
                ready: data.ready,
                overdue: data.overdue
            }
        });
    } catch (error) {
        logService.error('Failed to change store:', {
            error: error.message,
            stack: error.stack,
            newStore,
            previousStore: await storeService.getCurrentStore()
        });
        notificationService.showError(i18nService.translate('errorChangingStore'));
        throw error;
    } finally {
        storeSelect.disabled = false;
        loadingService.hide();
    }
}

function initializeStoreSelector() {
    try {
        const storeSelect = document.getElementById('store-select');
        if (!storeSelect) {
            logService.warn('Store selector not found');
            return;
        }

        // Clear existing options
        storeSelect.innerHTML = '';

        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = i18nService.translate('selectStore');
        defaultOption.disabled = true;
        storeSelect.appendChild(defaultOption);

        // Add store options from StoreService
        storeService.getAvailableStores().forEach(store => {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = `${store.name} - ${store.address}`;
            storeSelect.appendChild(option);
        });

        // Add store change handler
        storeSelect.addEventListener('change', (e) => {
            handleStoreChange(storeSelect, e.target.value).catch(error => {
                logService.error('Store change handler failed:', {
                    error: error.message,
                    stack: error.stack
                });
            });
        });

        // Return promise to handle store selection and initial data load
        return new Promise(async (resolve, reject) => {
            try {
                // Get current store from StoreService
                const currentStore = await storeService.getCurrentStore();
                
                if (currentStore) {
                    storeSelect.value = currentStore;
                } else {
                    // If no store is selected, select default
                    const defaultStore = await storeService.selectDefaultStore();
                    storeSelect.value = defaultStore;
                }

                // Initial data load for selected store
                try {
                    loadingService.show();
                    logService.debug('Loading initial data for store:', currentStore);
                    
                    // Force refresh on initial load to get fresh data
                    const data = await darwinaService.getData(true);
                    
                    // Update UI with data
                    if (data.drwn) {
                        const drwnTable = document.getElementById('drwn-data');
                        uiComponentService.renderDRWNTable(data.drwn, drwnTable);
                    }
                    
                    // Initialize counters with fresh data
                    updateCounters(data);
                    
                    // Log successful initialization
                    logService.debug('Initial data loaded:', {
                        store: currentStore,
                        hasOrders: Array.isArray(data.orders),
                        ordersCount: data.orders?.length,
                        counters: {
                            submitted: data.submitted,
                            confirmed: data.confirmed,
                            accepted: data.accepted,
                            ready: data.ready,
                            overdue: data.overdue
                        }
                    });

                    resolve();
                } catch (error) {
                    logService.error('Failed to load initial store data:', {
                        error: error.message,
                        stack: error.stack,
                        store: currentStore
                    });
                    notificationService.showError(i18nService.translate('errors.loading'));
                    reject(error);
                } finally {
                    loadingService.hide();
                }
            } catch (error) {
                logService.error('Failed to initialize store selection:', {
                    error: error.message,
                    stack: error.stack
                });
                reject(error);
            }
        });
    } catch (error) {
        logService.error('Failed to setup store selector:', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

function initializeUserSettings() {
    try {
        const userSettings = document.getElementById('user-settings');
        if (!userSettings) {
            logService.warn('User settings container not found');
            return;
        }

        // Load user data
        userCardService.getUserData().then(userData => {
            if (userData) {
                const nameInput = userSettings.querySelector('#user-name');
                const emailInput = userSettings.querySelector('#user-email');
                if (nameInput) nameInput.value = userData.name || '';
                if (emailInput) emailInput.value = userData.email || '';
            }
        });

        // Handle settings form submission
        const settingsForm = userSettings.querySelector('form');
        if (settingsForm) {
            settingsForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    loadingService.show();
                    const formData = new FormData(settingsForm);
                    const userData = {
                        name: formData.get('user-name'),
                        email: formData.get('user-email')
                    };
                    await userCardService.updateUserData(userData);
                    notificationService.showSuccess(i18nService.translate('settingsSaved'));
                } catch (error) {
                    logService.error('Failed to save user settings:', error);
                    notificationService.showError(i18nService.translate('errorSavingSettings'));
                } finally {
                    loadingService.hide();
                }
            });
        }
    } catch (error) {
        logService.error('Failed to initialize user settings:', error);
    }
}

function updateInterface() {
    try {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (key) {
                element.textContent = i18nService.translate(key);
            }
        });

        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (key) {
                element.setAttribute('placeholder', i18nService.translate(key));
            }
        });

        // Update tooltips
        document.querySelectorAll('[data-i18n-tooltip]').forEach(element => {
            const key = element.getAttribute('data-i18n-tooltip');
            if (key) {
                element.setAttribute('title', i18nService.translate(key));
            }
        });
    } catch (error) {
        logService.error('Failed to update interface:', error);
    }
}

async function loadInitialData() {
    try {
        logService.debug('Loading initial data...');
        
        // Initialize store selector first
        await initializeStoreSelector();

        // Setup tab change listener
        document.addEventListener('tabChanged', async (event) => {
            const tabId = event.detail.tabId;
            if (tabId === 'drwn' || tabId === 'ranking') {
                try {
                    loadingService.show();
                    const data = await darwinaService.getData(true); // Force refresh on tab change
                    if (tabId === 'drwn' && data.drwn) {
                        const drwnTable = document.getElementById('drwn-data');
                        uiComponentService.renderDRWNTable(data.drwn, drwnTable);
                    } else if (tabId === 'ranking' && data.ranking) {
                        const rankingTable = document.getElementById('ranking-data');
                        if (rankingTable) {
                            const headers = `
                                <tr>
                                    <th>Pozycja</th>
                                    <th>Imię i nazwisko</th>
                                </tr>
                            `;

                            const rows = data.ranking.map(item => `
                                <tr>
                                    <td>${item.position}</td>
                                    <td>${item.name}</td>
                                </tr>
                            `).join('');

                            rankingTable.innerHTML = `
                                <table class="table table-sm table-hover">
                                    <thead class="sticky-top bg-white">
                                        ${headers}
                                    </thead>
                                    <tbody>
                                        ${rows}
                                    </tbody>
                                </table>
                            `;
                        }
                    }
                    // Update counters after tab change
                    updateCounters(data);
            } catch (error) {
                    logService.error('Failed to update tab data:', error);
                    notificationService.showError('Failed to update data');
                } finally {
                    loadingService.hide();
                }
            }
        });

        // Hide loading state
                    loadingService.hide();
        logService.info('Initial data loaded successfully');
    } catch (error) {
        logService.error('Failed to load initial data:', error);
        loadingService.hide();
        throw error;
    }
}

function updateCounters(data) {
    try {
        if (!data) {
            logService.warn('No data provided to update counters');
            return;
        }

        // Log incoming data for debugging
        logService.debug('Updating counters with data:', {
            submitted: data.submitted,
            confirmed: data.confirmed,
            accepted: data.accepted,
            ready: data.ready,
            overdue: data.overdue,
            hasOrders: Array.isArray(data.orders),
            ordersCount: data.orders?.length
        });

        // Map counter values to HTML IDs with detailed logging
        const counters = {
            'count-1': data.submitted || 0,      // submitted
            'count-2': data.confirmed || 0,      // confirmed
            'count-3': data.accepted || 0,       // accepted
            'count-ready': data.ready || 0,      // ready
            'count-overdue': data.overdue || 0   // overdue
        };

        // Log counter mapping
        logService.debug('Counter mapping:', counters);

        // Update each counter with logging
        Object.entries(counters).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                logService.debug(`Updating counter ${id}:`, {
                    oldValue: element.textContent,
                    newValue: value
                });
                
                element.textContent = value;
                
                // Show counter container if hidden
                const container = element.closest('.lead-status');
                if (container) {
                    container.classList.remove('hidden');
                    // Add debug attribute for inspection
                    container.setAttribute('data-counter-value', value);
                    container.setAttribute('data-counter-id', id);
                }
            } else {
                logService.warn(`Counter element not found: ${id}`);
            }
        });

        // Verify final state
        Object.entries(counters).forEach(([id, expectedValue]) => {
            const element = document.getElementById(id);
            if (element) {
                const actualValue = element.textContent;
                if (actualValue != expectedValue) {
                    logService.warn(`Counter mismatch for ${id}:`, {
                        expected: expectedValue,
                        actual: actualValue
                    });
                }
            }
        });

        logService.debug('Counters updated:', counters);
    } catch (error) {
        logService.error('Failed to update counters:', {
            error: error.message,
            stack: error.stack,
            data: JSON.stringify(data)
        });
    }
}

function showLoginPrompt() {
    try {
        // Show login UI
        const loginContainer = document.getElementById('login-container');
        const mainContainer = document.getElementById('main-container');
        const errorContainer = document.getElementById('error-container');
        
        if (loginContainer && mainContainer && errorContainer) {
            // Hide other containers
            mainContainer.classList.add('hidden');
            errorContainer.classList.add('hidden');
            
            // Show login container
            loginContainer.classList.remove('hidden');
            
            // Show notification
            notificationService.show({
                title: 'Authentication Required',
                message: 'Please log in to continue',
                        type: 'basic',
                iconUrl: '/assets/icons/icon-48.png'
            });
            
            // Setup login form if exists
            const loginForm = loginContainer.querySelector('form');
            if (loginForm) {
                loginForm.addEventListener('submit', handleLogin);
                    }
                } else {
            logService.error('Required containers not found in DOM');
            throw new Error('Required containers not found');
        }
    } catch (error) {
        logService.error('Failed to show login prompt:', error);
        showErrorState(error);
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    try {
        loadingService.show();
        
        const formData = new FormData(event.target);
        const credentials = {
            username: formData.get('username'),
            password: formData.get('password')
        };
        
        // Attempt login
        const success = await darwinaService.login(credentials);
        
        if (success) {
            // Reload initial data
            await loadInitialData();
            
            // Show main container
            const loginContainer = document.getElementById('login-container');
            const mainContainer = document.getElementById('main-container');
            
            if (loginContainer && mainContainer) {
                loginContainer.classList.add('hidden');
                mainContainer.classList.remove('hidden');
            }
            
            notificationService.show({
                title: 'Welcome',
                message: 'Successfully logged in',
                type: 'success'
            });
            } else {
            notificationService.show({
                title: 'Login Failed',
                message: 'Invalid credentials',
                type: 'error'
            });
        }
    } catch (error) {
        logService.error('Login failed:', error);
        notificationService.showError('Failed to log in');
    } finally {
        loadingService.hide();
    }
}

function showErrorState(error) {
    // Show error UI
    const errorContainer = document.getElementById('error-container');
    const mainContainer = document.getElementById('main-container');
    
    if (errorContainer && mainContainer) {
        errorContainer.classList.remove('hidden');
        mainContainer.classList.add('hidden');
        
        const errorMessage = errorContainer.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.textContent = error.message || 'Failed to initialize application';
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', initialize);

// Export initialization function
export function initialize() {
    initializeServices().then(async () => {
        try {
            // Initialize HUD component
            logService.info('Initializing HUD...');
            await hud.initialize();
            logService.info('HUD initialized successfully');
            
            // Initialize refresh button after services are ready
            const refreshButton = document.getElementById('refresh-button');
            if (refreshButton) {
                refreshButton.addEventListener('click', async () => {
                    try {
                        logService.debug('Refresh button clicked');
                        
                        const spinner = refreshButton.querySelector('.spinner-border');
                        
                        // Disable button and show spinner
                        refreshButton.disabled = true;
                        if (spinner) spinner.classList.remove('d-none');
                        
                        logService.debug('Fetching fresh data...');
                        const data = await darwinaService.getData(true); // force refresh
                        
                        logService.debug('Fresh data received:', {
                            hasOrders: !!data.orders,
                            orderCount: data.orders?.length || 0,
                            counters: {
                                submitted: data.submitted || 0,
                                confirmed: data.confirmed || 0,
                                accepted: data.accepted || 0,
                                ready: data.ready || 0,
                                overdue: data.overdue || 0
                            }
                        });

                        // Update DRWN table
                        if (data.drwn) {
                            const drwnTable = document.getElementById('drwn-data');
                            if (drwnTable) {
                                uiComponentService.renderDRWNTable(data.drwn, drwnTable);
                            }
                        }
                        
                        // Update counters
                        updateCounters(data);
                        
                        // Show success notification
                        notificationService.showSuccess(i18nService.translate('notifications.dataRefreshed'));
                        
                        logService.debug('Data refresh complete');
                    } catch (error) {
                        logService.error('Refresh failed:', error);
                        notificationService.showError(i18nService.translate('notifications.refreshError'));
                    } finally {
                        // Re-enable button and hide spinner
                        refreshButton.disabled = false;
                        const spinner = refreshButton.querySelector('.spinner-border');
                        if (spinner) spinner.classList.add('d-none');
                    }
                });
            } else {
                logService.warn('Refresh button not found in DOM');
            }

            // Initialize performance metrics display
            initializePerformanceMetrics();

            // Initialize debug switch
            const debugSwitch = document.getElementById('debug-switch');
            if (debugSwitch) {
                debugSwitch.checked = logService.getLogLevel() === 'debug';
                debugSwitch.addEventListener('change', (e) => {
                    const level = e.target.checked ? 'debug' : 'info';
                    logService.setLogLevel(level);
                    notificationService.showSuccess(i18nService.translate(e.target.checked ? 'debugEnabled' : 'debugDisabled'));
                });
            }
        } catch (error) {
            logService.error('Failed to initialize application:', error);
            notificationService.showError('Failed to initialize application');
        }
    }).catch(error => {
        logService.error('Failed to initialize application:', error);
        notificationService.showError('Failed to initialize application');
    });
}

// Initialize performance metrics display
function initializePerformanceMetrics() {
    try {
        const refreshMetricsButton = document.getElementById('refresh-metrics');
        if (!refreshMetricsButton) {
            logService.warn('Refresh metrics button not found');
            return;
        }

        // Initial metrics update
        updatePerformanceMetrics();

        // Setup refresh button
        refreshMetricsButton.addEventListener('click', () => {
            updatePerformanceMetrics();
        });

        // Auto-update every minute
        setInterval(updatePerformanceMetrics, 60000);

        logService.debug('Performance metrics display initialized');
    } catch (error) {
        logService.error('Failed to initialize performance metrics:', error);
    }
}

// Update performance metrics display
function updatePerformanceMetrics() {
    try {
        const metrics = performanceMonitorService.getAllMetrics();
        
        // Format memory values to MB
        const formatMemory = (bytes) => {
            if (!bytes) return '-';
            return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        };

        // Update memory metrics
        const heapSize = document.getElementById('metric-jsHeapSize');
        const totalHeapSize = document.getElementById('metric-totalJSHeapSize');
        const heapLimit = document.getElementById('metric-jsHeapLimit');
        
        if (heapSize) heapSize.textContent = formatMemory(metrics.jsHeapSize?.[metrics.jsHeapSize?.length - 1]?.value);
        if (totalHeapSize) totalHeapSize.textContent = formatMemory(metrics.totalJSHeapSize?.[metrics.totalJSHeapSize?.length - 1]?.value);
        if (heapLimit) heapLimit.textContent = formatMemory(metrics.jsHeapLimit?.[metrics.jsHeapLimit?.length - 1]?.value);

        // Update long tasks metric
        const longTask = document.getElementById('metric-longTask');
        if (longTask) {
            const lastLongTask = metrics.longTask?.[metrics.longTask?.length - 1];
            if (lastLongTask) {
                const duration = lastLongTask.value;
                const time = new Date(lastLongTask.timestamp).toLocaleTimeString();
                longTask.textContent = `${duration.toFixed(2)}ms (${time})`;
            } else {
                longTask.textContent = '-';
            }
        }

        logService.debug('Performance metrics updated:', metrics);
    } catch (error) {
        logService.error('Failed to update performance metrics:', error);
    }
}

