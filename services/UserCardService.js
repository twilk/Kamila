import { logService } from './LogService.js';
import { apiService } from './ApiService.js';
import { cacheService } from './CacheService.js';
import { darwinaService } from './DarwinaService.js';

const QR_CONFIG = {
    width: 256,
    height: 256,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: 'H'
};

const SIGNATURE_CONFIG = {
    format: 'png',
    width: 300,
    height: 100
};

/**
 * Service for managing user card data and operations
 */
export class UserCardService {
    constructor() {
        this.initialized = false;
        this.initializing = false;
        this.userData = null;
        this.initError = null;
        logService.info('UserCardService constructed');
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            logService.info('Initializing UserCardService...');

            // Sprawdź czy mamy userId w storage
            const storage = await chrome.storage.local.get('userId');
            if (!storage.userId) {
                // Ustaw domyślne ID użytkownika (2)
                await chrome.storage.local.set({ userId: '2' });
                logService.info('Set default user ID: 2');
            }

            // Załaduj dane użytkownika
            await this.loadUserData();
            
            this.initialized = true;
            logService.info('UserCardService initialized successfully');
        } catch (error) {
            this.initError = error;
            logService.warn('Failed to load initial user data, continuing with empty state', {});
            this.initialized = true; // Pozwalamy na inicjalizację nawet przy błędzie
        }
    }

    async loadUserData() {
        try {
            const userData = await this.refreshUserData();
            if (this.validateUserData(userData)) {
                this.userData = userData;
                logService.debug('User data loaded successfully');
            } else {
                throw new Error('Invalid user data format');
            }
        } catch (error) {
            logService.error('Failed to load user data', {});
            throw error;
        }
    }

    async getUserData() {
        if (!this.initialized) {
            throw new Error('Cannot get user data before initialization');
        }

        try {
            if (!this.userData) {
                await this.refreshUserData();
            }
            return this.userData;
        } catch (error) {
            logService.error('Failed to get user data', error);
            throw error;
        }
    }

    async loadUserFromFile(userId) {
        try {
            logService.debug('Loading user data from file:', userId);
            const response = await fetch(chrome.runtime.getURL(`users/${userId}.json`));
            
            if (!response.ok) {
                throw new Error(`Failed to load user file: ${response.status} ${response.statusText}`);
            }
            
            const userData = await response.json();
            
            // Dodaj URL do QR kodu - używamy bezpośrednio pliku PNG
            userData.qrCodeImageUrl = chrome.runtime.getURL(`qrcodes/${userId}.png`);
            logService.debug('QR code URL added:', userData.qrCodeImageUrl);
            
            logService.debug('User data loaded from file successfully');
            return userData;
        } catch (error) {
            logService.error(`Failed to load user file for ID ${userId}:`, error);
            throw error;
        }
    }

    async getQRCode() {
        if (!this.initialized) {
            throw new Error('Cannot get QR code before initialization');
        }

        try {
            if (!this.userData || !this.userData.memberId) {
                await this.refreshUserData();
            }

            if (!this.userData || !this.userData.memberId) {
                throw new Error('No valid user data available');
            }

            return this.userData.qrCodeImageUrl;
        } catch (error) {
            logService.error('Failed to get QR code:', error);
            throw error;
        }
    }

    async refreshUserData() {
        try {
            logService.debug('Refreshing user data...');
            
            if (darwinaService.devBypassAuth) {
                // Return mock data in development mode
                const mockData = {
                    id: 'dev_user_1',
                    fullName: 'Developer Test',
                    email: 'dev@darwina.pl',
                    role: 'admin',
                    status: 'active',
                    permissions: ['read', 'write', 'admin'],
                    settings: {
                        theme: 'light',
                        notifications: true,
                        language: 'polish'
                    },
                    lastLogin: new Date().toISOString(),
                    created: '2024-01-01T00:00:00Z'
                };
                logService.info('Using mock user data in development mode');
                return mockData;
            }

            // Pobierz userId ze storage
            const storage = await chrome.storage.local.get('userId');
            if (!storage.userId) {
                throw new Error('No user ID found in storage');
            }
            
            const userId = storage.userId;
            logService.debug('User ID found in storage:', userId);

            // Załaduj dane użytkownika z pliku
            const userData = await this.loadUserFromFile(userId);
            if (!userData) {
                throw new Error('Failed to load user data from file');
            }

            // Upewnij się że mamy memberId
            userData.memberId = userId;
            this.userData = userData;

            logService.debug('User data refreshed successfully:', {
                userId: userData.memberId,
                hasData: !!userData,
                dataKeys: Object.keys(userData)
            });
            
            return userData;
        } catch (error) {
            logService.error('Failed to refresh user data:', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    validateUserData(data) {
        return data && 
               typeof data === 'object' && 
               typeof data.fullName === 'string' &&
               typeof data.email === 'string';
    }

    getInitializationError() {
        return this.initError;
    }

    isInitialized() {
        return this.initialized;
    }

    cleanup() {
        this.initialized = false;
        this.userData = null;
        this.initError = null;
    }
}

export const userCardService = new UserCardService(); 