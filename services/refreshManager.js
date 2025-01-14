import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';
import { DataManager } from './dataManager.js';
import { UIManager } from './core/UIManager.js';

export class RefreshManager extends BaseManager {
    constructor() {
        super();
        this._dataManager = null;
        this._uiManager = null;
        this.refreshButton = null;
        this.isRefreshing = false;
        this.messageListener = null;
        this.handleRefresh = this.handleRefresh.bind(this);
        this.handleRefreshStatus = this.handleRefreshStatus.bind(this);
    }

    async initialize() {
        try {
            // Create and add dependencies
            const uiManager = new UIManager();
            await uiManager.initialize();
            this.dependencies.add(uiManager);

            const dataManager = new DataManager();
            dataManager.dependencies.add(uiManager);
            await dataManager.initialize();
            this.dependencies.add(dataManager);

            // Initialize base with dependencies ready
            await super.initialize();

            // Store references
            this._uiManager = uiManager;
            this._dataManager = dataManager;

            // Initialize UI components and event listeners
            await this.initializeRefreshButton();
            this.setupMessageListener();
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize',
                context: 'Initialization of RefreshManager failed'
            });
            return false;
        }
    }

    setupMessageListener() {
        try {
            // Store the listener function as a class property for cleanup
            this.messageListener = (message, sender, sendResponse) => {
                if (message?.type === 'REFRESH_STATUS') {
                    this.handleRefreshStatus(message.payload?.status, message.payload?.error);
                    sendResponse({ received: true });
                }
                return true;
            };
            
            // Add the listener
            chrome.runtime.onMessage.addListener(this.messageListener);
        } catch (error) {
            this.handleError(error, ErrorType.EVENT, ErrorSeverity.WARNING, {
                method: 'setupMessageListener',
                context: 'Failed to setup message listener'
            });
        }
    }

    async initializeRefreshButton() {
        try {
            // Try to find the refresh button
            this.refreshButton = document.getElementById('refresh-button');
            
            if (!this.refreshButton) {
                // Wait for DOM to be ready
                await new Promise(resolve => {
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', resolve);
                    } else {
                        resolve();
                    }
                });

                // Try again after DOM is ready
                this.refreshButton = document.getElementById('refresh-button');
            }

            if (this.refreshButton) {
                this.refreshButton.addEventListener('click', this.handleRefresh);
                console.log('[INFO] 🔄 Refresh button initialized');
            } else {
                // Create refresh button if it doesn't exist
                this.refreshButton = document.createElement('button');
                this.refreshButton.id = 'refresh-button';
                this.refreshButton.className = 'btn btn-primary refresh-btn';
                this.refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Odśwież';
                this.refreshButton.addEventListener('click', this.handleRefresh);

                // Find a suitable container for the button
                const container = document.querySelector('.actions-container') || 
                                document.querySelector('.toolbar') ||
                                document.body;
                
                if (container) {
                    container.appendChild(this.refreshButton);
                    console.log('[INFO] 🔄 Created and initialized refresh button');
                } else {
                    console.warn('[WARNING] ⚠️ Could not find suitable container for refresh button');
                }
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeRefreshButton',
                context: 'Failed to initialize refresh button'
            });
        }
    }

    async handleRefresh() {
        if (this.isRefreshing) {
            console.warn('[WARNING] ⚠️ Refresh already in progress');
            return;
        }

        try {
            this.isRefreshing = true;
            this._uiManager.showMessage('loading', 'Odświeżanie danych...');
            
            if (this.refreshButton) {
                this.refreshButton.disabled = true;
                this.refreshButton.classList.add('refreshing');
            }

            await this._dataManager.refreshData();

            this._uiManager.showMessage('success', 'Dane zostały odświeżone', 3000);
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.ERROR, {
                method: 'handleRefresh'
            });
            this._uiManager.showMessage('error', 'Błąd odświeżania danych');
        } finally {
            this.isRefreshing = false;
            if (this.refreshButton) {
                this.refreshButton.disabled = false;
                this.refreshButton.classList.remove('refreshing');
            }
        }
    }

    handleRefreshStatus(status, error = null) {
        try {
            switch (status) {
                case 'started':
                    this.isRefreshing = true;
                    this._uiManager.showMessage('loading', 'Odświeżanie danych...');
                    if (this.refreshButton) {
                        this.refreshButton.disabled = true;
                        this.refreshButton.classList.add('refreshing');
                    }
                    break;

                case 'completed':
                    this.isRefreshing = false;
                    this._uiManager.showMessage('success', 'Dane zostały odświeżone', 3000);
                    if (this.refreshButton) {
                        this.refreshButton.disabled = false;
                        this.refreshButton.classList.remove('refreshing');
                    }
                    break;

                case 'error':
                    this.isRefreshing = false;
                    this._uiManager.showMessage('error', error || 'Błąd odświeżania danych');
                    if (this.refreshButton) {
                        this.refreshButton.disabled = false;
                        this.refreshButton.classList.remove('refreshing');
                    }
                    break;

                default:
                    console.warn(`[WARNING] ⚠️ Unknown refresh status: ${status}`);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'handleRefreshStatus',
                status
            });
        }
    }

    async dispose() {
        try {
            // Remove event listeners
            if (this.refreshButton) {
                this.refreshButton.removeEventListener('click', this.handleRefresh);
            }

            // Remove message listener
            if (this.messageListener) {
                chrome.runtime.onMessage.removeListener(this.messageListener);
            }

            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'dispose'
            });
        }
    }
} 