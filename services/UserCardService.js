import { logService } from './LogService.js';
import { apiService } from './ApiService.js';
import { cacheService } from './CacheService.js';

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
            logService.debug('UserCardService already initialized');
            return;
        }

        if (this.initializing) {
            logService.debug('UserCardService initialization already in progress');
            return;
        }

        try {
            this.initializing = true;
            logService.info('Initializing UserCardService...');
            
            // First mark as initialized so other methods know we're ready
            this.initialized = true;
            
            // Then try to load initial data
            try {
                await this.loadUserData();
            } catch (error) {
                // Don't fail initialization if data load fails
                logService.warn('Failed to load initial user data, continuing with empty state', error);
                this.initError = error;
            }
            
            logService.info('UserCardService initialized successfully');
        } catch (error) {
            this.initialized = false;
            this.initError = error;
            logService.error('Failed to initialize UserCardService', error);
            throw error;
        } finally {
            this.initializing = false;
        }
    }

    async loadUserData() {
        try {
            logService.debug('Loading user data...');
            
            // Try to get from cache first
            const cachedData = await cacheService.get('userData');
            if (cachedData) {
                this.userData = cachedData;
                logService.debug('User data loaded from cache');
                return;
            }

            // Fetch fresh data if not in cache
            await this.refreshUserData();
        } catch (error) {
            logService.error('Failed to load user data', error);
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

    async refreshUserData() {
        if (!this.initialized) {
            throw new Error('Cannot refresh user data before initialization');
        }

        try {
            logService.debug('Fetching fresh user data...');
            const freshData = await apiService.get('/user/data');
            
            // Validate data
            if (!this.validateUserData(freshData)) {
                throw new Error('Invalid user data received from API');
            }
            
            // Update cache and local data
            await cacheService.set('userData', freshData);
            this.userData = freshData;
            
            logService.debug('User data refreshed successfully');
            return freshData;
        } catch (error) {
            logService.error('Failed to refresh user data', error);
            throw error;
        }
    }

    validateUserData(data) {
        return data && 
               typeof data === 'object' && 
               typeof data.name === 'string' &&
               typeof data.email === 'string';
    }

    getInitializationError() {
        return this.initError;
    }

    isInitialized() {
        return this.initialized;
    }

    async generateQRCode(data) {
        if (!this.initialized) {
            throw new Error('Cannot generate QR code before initialization');
        }

        try {
            logService.debug('Generating QR code...');
            
            const qrData = await apiService.post('/qr/generate', {
                data,
                options: QR_CONFIG
            });
            
            logService.debug('QR code generated successfully');
            return qrData;
        } catch (error) {
            logService.error('Failed to generate QR code', error);
            throw error;
        }
    }

    async generateSignature(data) {
        if (!this.initialized) {
            throw new Error('Cannot generate signature before initialization');
        }

        try {
            logService.debug('Generating signature...');
            
            const signatureData = await apiService.post('/signature/generate', {
                data,
                options: SIGNATURE_CONFIG
            });
            
            logService.debug('Signature generated successfully');
            return signatureData;
        } catch (error) {
            logService.error('Failed to generate signature', error);
            throw error;
        }
    }

    async updateUserCard(data) {
        if (!this.initialized) {
            throw new Error('Cannot update user card before initialization');
        }

        try {
            logService.debug('Updating user card...', { data });
            
            // Validate update data
            if (!this.validateUserData(data)) {
                throw new Error('Invalid user card update data');
            }

            // Update user card
            const updatedData = await apiService.put('/user/card', data);
            
            // Validate response
            if (!this.validateUserData(updatedData)) {
                throw new Error('Invalid user data received from API');
            }
            
            // Update cache and local data
            await cacheService.set('userData', updatedData);
            this.userData = updatedData;
            
            logService.debug('User card updated successfully');
            return updatedData;
        } catch (error) {
            logService.error('Failed to update user card', error);
            throw error;
        }
    }

    async clearUserData() {
        if (!this.initialized) {
            throw new Error('Cannot clear user data before initialization');
        }

        try {
            logService.debug('Clearing user data...');
            await cacheService.delete('userData');
            this.userData = null;
            logService.debug('User data cleared successfully');
        } catch (error) {
            logService.error('Failed to clear user data', error);
            throw error;
        }
    }

    cleanup() {
        if (!this.initialized) return;

        try {
            logService.debug('Cleaning up UserCardService...');
            this.userData = null;
            this.initialized = false;
            this.initError = null;
            logService.debug('UserCardService cleaned up successfully');
        } catch (error) {
            logService.error('Error during cleanup', error);
            throw error;
        }
    }
}

export const userCardService = new UserCardService(); 