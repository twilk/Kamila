import { logService } from './LogService.js';
import { apiService } from './ApiService.js';
import { cacheService } from './CacheService.js';
import { darwinaService } from './DarwinaService.js';
import { i18nService } from './I18nService.js';
import { notificationService } from './NotificationService.js';

/**
 * Service for managing user card data and UI
 */
class UserCardService {
    constructor() {
        this.userData = null;
        this.isInitialized = false;
        this.cardElement = null;
        this.qrCodeElement = null;
        this.nameElement = null;
        logService.info('UserCardService constructed');
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            logService.info('Initializing UserCardService...');
            
            // Initialize UI elements
            this.initializeUIElements();
            
            // Load initial user data
            await this.loadUserData();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            logService.info('UserCardService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize UserCardService', error);
            throw error;
        }
    }

    initializeUIElements() {
        try {
            this.cardElement = document.querySelector('.user-card-flip');
            this.qrCodeElement = document.querySelector('.qr-code');
            this.nameElement = document.querySelector('.user-name');

            if (!this.cardElement || !this.qrCodeElement || !this.nameElement) {
                throw new Error('Required UI elements not found');
            }

            // Initialize card flip functionality
            this.cardElement.addEventListener('click', () => {
                const inner = this.cardElement.querySelector('.user-card-inner');
                if (inner) {
                    inner.classList.toggle('flipped');
                }
            });

            logService.debug('UI elements initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize UI elements', error);
            throw error;
        }
    }

    setupEventListeners() {
        try {
            // Listen for user selection changes
            const userSelect = document.getElementById('user-select');
            if (userSelect) {
                userSelect.addEventListener('change', async (event) => {
                    const userId = event.target.value;
                    if (userId) {
                        await this.changeUser(userId);
                    }
                });
            }

            // Listen for store changes
            document.addEventListener('storeChanged', async () => {
                await this.refreshUserCard();
            });

            logService.debug('Event listeners set up successfully');
        } catch (error) {
            logService.error('Failed to setup event listeners', error);
            throw error;
        }
    }

    async loadUserData() {
        try {
            logService.debug('Loading user data...');
            
            // Try to get from cache first
            const cachedData = await cacheService.get('userData');
            if (cachedData) {
                await this.updateUI(cachedData);
                this.userData = cachedData;
                logService.debug('User data loaded from cache');
                return cachedData;
            }

            // If not in cache, fetch from API
            const { selectedStore } = await chrome.storage.local.get('selectedStore');
            if (!selectedStore) {
                throw new Error('No store selected');
            }

            const freshData = await darwinaService.getUserData(selectedStore);
            if (!this.validateUserData(freshData)) {
                throw new Error('Invalid user data received');
            }

            this.userData = freshData;
            await this.updateUI(freshData);
            
            // Cache the result
            await cacheService.set('userData', freshData, 300); // 5 minutes cache
            
            logService.debug('User data loaded and UI updated');
            return freshData;
        } catch (error) {
            logService.error('Failed to load user data', error);
            notificationService.showError(i18nService.translate('errors.loading'));
            throw error;
        }
    }

    async updateUI(userData) {
        try {
            if (!userData || !this.nameElement || !this.qrCodeElement) {
                throw new Error('Missing required data or UI elements');
            }

            // Update name
            this.nameElement.textContent = userData.firstName || '-';

            // Update QR code
            if (userData.qrCodeUrl) {
                this.qrCodeElement.src = userData.qrCodeUrl;
                this.qrCodeElement.alt = `QR Code for ${userData.firstName}`;
            }

            logService.debug('UI updated successfully');
        } catch (error) {
            logService.error('Failed to update UI', error);
            throw error;
        }
    }

    async changeUser(userId) {
        try {
            logService.debug('Changing user...', { userId });
            
            // Save selected user
            await chrome.storage.local.set({ userId });
            
            // Refresh user data
            await this.refreshUserCard();
            
            notificationService.showSuccess(i18nService.translate('userChanged'));
            logService.info('User changed successfully');
        } catch (error) {
            logService.error('Failed to change user', error);
            notificationService.showError(i18nService.translate('errorChangingUser'));
            throw error;
        }
    }

    async refreshUserCard() {
        try {
            logService.debug('Refreshing user card...');
            
            // Clear cache
            await cacheService.delete('userData');
            
            // Load fresh data
            const freshData = await this.loadUserData();
            
            // Update UI
            await this.updateUI(freshData);
            
            logService.info('User card refreshed successfully');
            return freshData;
        } catch (error) {
            logService.error('Failed to refresh user card', error);
            notificationService.showError(i18nService.translate('errorRefreshingCard'));
            throw error;
        }
    }

    validateUserData(data) {
        return data && 
               typeof data === 'object' && 
               typeof data.firstName === 'string' &&
               typeof data.qrCodeUrl === 'string';
    }

    getUserData() {
        return this.userData;
    }

    cleanup() {
        try {
            logService.debug('Cleaning up UserCardService...');
            
            // Remove event listeners
            if (this.cardElement) {
                this.cardElement.removeEventListener('click', () => {});
            }
            
            // Clear data
            this.userData = null;
            this.isInitialized = false;
            
            // Clear UI references
            this.cardElement = null;
            this.qrCodeElement = null;
            this.nameElement = null;
            
            logService.debug('UserCardService cleaned up successfully');
        } catch (error) {
            logService.error('Error during cleanup', error);
            throw error;
        }
    }
}

// Create and export singleton instance
export const userCardService = new UserCardService(); 