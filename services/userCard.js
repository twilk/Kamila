import { logService } from './LogService.js';
import { apiService } from './ApiService.js';
import { cacheService } from './CacheService.js';

/**
 * Service for managing user card data
 */
class UserCardService {
    constructor() {
        this.userData = null;
        this.isInitialized = false;
        logService.info('UserCardService constructed');
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            logService.info('Initializing UserCardService...');
            await this.loadUserData();
            this.isInitialized = true;
            logService.info('UserCardService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize UserCardService', error);
            throw error;
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
                return cachedData;
            }

            // If not in cache, fetch from API
            const freshData = await apiService.get('/user/data');
            this.userData = freshData;
            
            // Cache the result
            await cacheService.set('userData', freshData, 300); // 5 minutes cache
            
            logService.debug('User data loaded from API');
            return freshData;
        } catch (error) {
            logService.error('Failed to load user data', error);
            throw error;
        }
    }

    async updateUserCard(data) {
        try {
            logService.debug('Updating user card...', data);
            
            // Validate data
            if (!data.name || !data.email) {
                throw new Error('Invalid user card data');
            }

            // Update via API
            const updatedData = await apiService.put('/user/card', data);
            this.userData = updatedData;
            
            // Update cache
            await cacheService.set('userData', updatedData, 300);
            
            logService.info('User card updated successfully');
            return updatedData;
        } catch (error) {
            logService.error('Failed to update user card', error);
            throw error;
        }
    }

    async generateQRCode() {
        try {
            logService.debug('Generating QR code...');
            
            if (!this.userData) {
                throw new Error('User data not loaded');
            }

            const qrData = await apiService.post('/qr/generate', {
                data: this.userData,
                options: {
                    width: 256,
                    height: 256,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: 'H'
                }
            });
            
            logService.debug('QR code generated successfully');
            return qrData;
        } catch (error) {
            logService.error('Failed to generate QR code', error);
            throw error;
        }
    }

    async generateSignature() {
        try {
            logService.debug('Generating signature...');
            
            if (!this.userData) {
                throw new Error('User data not loaded');
            }

            const signatureData = await apiService.post('/signature/generate', {
                data: this.userData,
                options: {
                    format: 'png',
                    width: 300,
                    height: 100
                }
            });
            
            logService.debug('Signature generated successfully');
            return signatureData;
        } catch (error) {
            logService.error('Failed to generate signature', error);
            throw error;
        }
    }

    async refreshUserCard() {
        try {
            logService.debug('Refreshing user card...');
            await cacheService.delete('userData');
            const freshData = await this.loadUserData();
            logService.info('User card refreshed successfully');
            return freshData;
        } catch (error) {
            logService.error('Failed to refresh user card', error);
            throw error;
        }
    }

    getUserData() {
        return this.userData;
    }
}

// Create and export singleton instance
export const userCardService = new UserCardService(); 