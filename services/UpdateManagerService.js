import { logService } from './LogService.js';
import { cacheService } from './CacheService.js';
import { notificationService } from './NotificationService.js';
import { apiService } from './ApiService.js';
import { API_CONFIG } from '../config/api.js';

export class UpdateManagerService {
    constructor() {
        this.initialized = false;
        this.listeners = new Set();
        this.isCheckingForUpdates = false;
        this.intervalId = null;
        this.endpoints = API_CONFIG.DARWINA.ENDPOINTS;
        
        // Safely get version from manifest
        try {
            this.currentVersion = this.isExtensionContext() ? 
                chrome.runtime.getManifest().version : 
                '1.0.0';
        } catch (error) {
            this.currentVersion = '1.0.0';
            logService.warn('Failed to get manifest version, using default');
        }
        
        this.updateCheckInterval = 1000 * 60 * 60; // 1 hour
        logService.info('UpdateManagerService constructed', { version: this.currentVersion });
    }

    async initialize() {
        if (this.initialized) {
            logService.debug('UpdateManagerService already initialized');
            return;
        }

        try {
            logService.info('Initializing UpdateManagerService...');
            
            // Setup update listeners first
            this.listenForUpdates();
            
            // Mark as initialized before starting checks
            this.initialized = true;
            logService.info('UpdateManagerService initialized successfully');
            
            // Start update checks in background after initialization
            setTimeout(() => {
                this.startUpdateCheck().catch(error => {
                    logService.error('Background update check failed:', error);
                });
            }, 1000); // Delay first check by 1 second
            
        } catch (error) {
            logService.error('Failed to initialize UpdateManagerService', error);
            // Don't throw, just mark as initialized with default state
            this.initialized = true;
        }
    }

    async startUpdateCheck() {
        try {
            logService.debug('Starting update check cycle');
            
            // Perform initial check
            await this.checkForUpdates();
            
            // Setup interval for periodic checks
            if (!this.intervalId) {
                this.intervalId = setInterval(
                    () => this.checkForUpdates().catch(error => {
                        logService.error('Periodic update check failed:', error);
                    }), 
                    this.updateCheckInterval
                );
            }
        } catch (error) {
            logService.error('Failed to start update check cycle:', error);
        }
    }

    stopUpdateCheck() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logService.debug('Update check cycle stopped');
        }
    }

    async checkForUpdates() {
        if (!this.initialized) {
            logService.warn('Cannot check for updates before initialization');
            return null;
        }

        if (this.isCheckingForUpdates) {
            logService.debug('Update check already in progress, skipping');
            return null;
        }

        this.isCheckingForUpdates = true;
        try {
            logService.debug('Checking for updates...');
            
            // Check if we should skip based on last check time
            const lastCheck = await cacheService.get('lastUpdateCheck');
            const now = Date.now();
            
            if (lastCheck && (now - lastCheck < this.updateCheckInterval)) {
                logService.debug('Skipping update check - too soon since last check');
                return null;
            }

            let updateInfo = null;

            // Try API first if we have auth
            const hasAuth = await cacheService.get('authToken');
            if (hasAuth) {
                try {
                    const response = await apiService.get(this.endpoints.CHECK_UPDATE);
                    if (response?.version) {
                        updateInfo = response;
                        await cacheService.set('lastUpdateCheck', now);
                        logService.debug('Update info fetched from API', { version: response.version });
                    }
                } catch (apiError) {
                    if (apiError?.response?.status === 401) {
                        logService.debug('API update check failed - unauthorized');
                    } else {
                        logService.warn('API update check failed:', apiError?.message || 'Unknown error');
                    }
                }
            } else {
                logService.debug('Skipping API update check - no auth token');
            }

            // Fall back to Chrome update check if API failed
            if (!updateInfo && this.isExtensionContext()) {
                try {
                    if (chrome.runtime.requestUpdateCheck) {
                        const [status, details] = await new Promise((resolve, reject) => {
                            chrome.runtime.requestUpdateCheck((status, details) => {
                                if (chrome.runtime.lastError) {
                                    reject(chrome.runtime.lastError);
                                } else {
                                    resolve([status, details]);
                                }
                            });
                        });

                        logService.debug('Chrome update check completed', { status });
                        
                        if (status === 'update_available' && details?.version) {
                            updateInfo = { version: details.version };
                        }
                    }
                } catch (chromeError) {
                    if (chromeError?.message?.includes('extension is not allowed')) {
                        logService.debug('Chrome update check not allowed in this context');
                    } else {
                        logService.error('Chrome update check failed:', chromeError?.message || 'Unknown error');
                    }
                }
            }

            // Handle update if found
            if (updateInfo?.version && updateInfo.version !== this.currentVersion) {
                this.handleUpdateAvailable(updateInfo);
                return updateInfo;
            }

            logService.debug('No updates available');
            return null;
        } catch (error) {
            logService.error('Failed to check for updates:', error?.message || 'Unknown error');
            return null;
        } finally {
            this.isCheckingForUpdates = false;
        }
    }

    listenForUpdates() {
        try {
            // Check if we're in a Chrome extension context
            if (!this.isExtensionContext()) {
                logService.warn('Not in Chrome extension context, skipping update listeners');
                return;
            }

            // Safely add listeners
            this.safelyAddUpdateListeners();
            
            logService.debug('Update listeners registered');
        } catch (error) {
            logService.error('Failed to setup update listeners:', error);
            // Don't throw, continue without update listeners
        }
    }

    isExtensionContext() {
        try {
            return typeof chrome !== 'undefined' && 
                   chrome.runtime && 
                   typeof chrome.runtime.getManifest === 'function';
        } catch (error) {
            logService.warn('Failed to check extension context:', error);
            return false;
        }
    }

    safelyAddUpdateListeners() {
        if (!this.isExtensionContext()) {
            logService.warn('Not in extension context, skipping listeners');
            return;
        }

        // Add update available listener
        try {
            if (chrome.runtime.onUpdateAvailable) {
                chrome.runtime.onUpdateAvailable.addListener(details => {
                    this.handleUpdateAvailable(details);
                });
                logService.debug('Update available listener added');
            }
        } catch (error) {
            logService.error('Failed to add update available listener:', error);
        }

        // Add update check listener
        try {
            if (chrome.runtime.onUpdateCheck) {
                chrome.runtime.onUpdateCheck.addListener(status => {
                    logService.debug('Update check completed', { status });
                });
                logService.debug('Update check listener added');
            }
        } catch (error) {
            logService.error('Failed to add update check listener:', error);
        }
    }

    handleUpdateAvailable(details) {
        const newVersion = details.version;
        
        notificationService.show({
            title: 'Update Available',
            message: `Version ${newVersion} is available. Restart to update.`,
            type: 'info',
            buttons: [{
                title: 'Restart Now',
                action: () => this.restartToUpdate()
            }]
        });

        logService.info('Update available', { 
            currentVersion: this.currentVersion, 
            newVersion 
        });
    }

    restartToUpdate() {
        logService.info('Restarting to apply update...');
        chrome.runtime.reload();
    }

    getCurrentVersion() {
        return this.currentVersion;
    }

    forceUpdate() {
        logService.info('Forcing update check...');
        return this.checkForUpdates();
    }

    cleanup() {
        logService.debug('Cleaning up UpdateManagerService...');
        this.stopUpdateCheck();
        this.listeners.clear();
        logService.debug('UpdateManagerService cleaned up successfully');
    }
}

export const updateManagerService = new UpdateManagerService(); 