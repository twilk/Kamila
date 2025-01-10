import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';

export class RefreshManager extends BaseManager {
    constructor(dataManager) {
        super();
        this.dataManager = dataManager;
        this.refreshButton = null;
        this.isRefreshing = false;
        this.handleRefresh = this.handleRefresh.bind(this);
    }

    async initialize() {
        try {
            await super.initialize();
            await this.initializeRefreshButton();
            this.setupMessageListener();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    setupMessageListener() {
        // Store the listener function as a class property so we can remove it later
        this.messageListener = (message, sender, sendResponse) => {
            if (message.type === 'REFRESH_STATUS') {
                this.handleRefreshStatus(message.payload?.status, message.payload?.error);
                sendResponse({ received: true });
            }
            return true;
        };
        
        // Add the listener
        chrome.runtime.onMessage.addListener(this.messageListener);
    }

    async initializeRefreshButton() {
        try {
            this.refreshButton = document.getElementById('refresh-store-data');
            if (!this.refreshButton) {
                throw new Error('Refresh button not found');
            }

            this.refreshButton.addEventListener('click', this.handleRefresh);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeRefreshButton'
            });
        }
    }

    async handleRefresh() {
        if (this.isRefreshing) return;
        
        try {
            this.isRefreshing = true;
            this.setButtonLoadingState(true);

            // Check system status first
            if (this.dataManager && typeof this.dataManager.checkStatus === 'function') {
                const status = await this.dataManager.checkStatus();
                if (!status.api || !status.auth) {
                    throw new Error('System is not ready. Please check your connection.');
                }
            }

            // Check if background script is available
            if (!chrome.runtime?.id) {
                throw new Error('Extension context invalidated');
            }

            // Send refresh request to background script
            const response = await this.sendRefreshRequest();
            
            if (response?.success) {
                // Force refresh data through DataManager
                if (this.dataManager && typeof this.dataManager.refreshData === 'function') {
                    await this.dataManager.refreshData();
                    this.handleSuccess('Data refreshed successfully');
                } else {
                    throw new Error('DataManager not properly initialized');
                }
            } else {
                throw new Error(response?.error || 'Refresh failed');
            }
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.ERROR, {
                method: 'handleRefresh'
            });
            // Show error message to user
            if (this.dataManager?.uiManager) {
                this.dataManager.uiManager.showMessage('error', 'Failed to refresh data: ' + error.message);
            }
        } finally {
            this.isRefreshing = false;
            this.setButtonLoadingState(false);
        }
    }

    async sendRefreshRequest() {
        try {
            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Refresh request timed out'));
                }, 30000); // 30 second timeout

                // Sprawdź czy background script jest dostępny
                if (!chrome.runtime?.id) {
                    clearTimeout(timeoutId);
                    reject(new Error('Extension context invalidated'));
                    return;
                }

                chrome.runtime.sendMessage({ 
                    type: 'REFRESH_DATA_REQUEST' 
                }, response => {
                    clearTimeout(timeoutId);
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(new Error(error.message));
                    } else {
                        resolve(response);
                    }
                });
            });
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.ERROR, {
                method: 'sendRefreshRequest'
            });
            throw error;
        }
    }

    handleRefreshStatus(status, error = null) {
        if (!chrome.runtime?.id) {
            this.handleError(new Error('Extension context invalidated'), ErrorType.DATA, ErrorSeverity.ERROR, {
                method: 'handleRefreshStatus'
            });
            return;
        }

        if (error) {
            this.handleError(new Error(error), ErrorType.DATA, ErrorSeverity.ERROR, {
                method: 'handleRefreshStatus'
            });
            return;
        }

        switch (status) {
            case 'started':
                this.setButtonLoadingState(true);
                break;
            case 'completed':
                this.handleSuccess('Refresh completed');
                this.setButtonLoadingState(false);
                break;
            case 'failed':
                this.handleError(new Error('Refresh failed'), ErrorType.DATA, ErrorSeverity.ERROR, {
                    method: 'handleRefreshStatus'
                });
                this.setButtonLoadingState(false);
                break;
        }
    }

    setButtonLoadingState(loading) {
        if (this.refreshButton) {
            this.refreshButton.disabled = loading;
            const icon = this.refreshButton.querySelector('.bi-arrow-clockwise');
            if (icon) {
                icon.classList.toggle('rotate', loading);
            }
        }
    }

    dispose() {
        try {
            if (this.refreshButton) {
                this.refreshButton.removeEventListener('click', this.handleRefresh);
            }
            if (this.messageListener) {
                chrome.runtime.onMessage.removeListener(this.messageListener);
            }
            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 