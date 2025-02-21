import { APIManager } from './index.js';
import { ErrorType, ErrorSeverity } from '../core/ErrorTypes.js';

const apiManager = APIManager.getInstance();

export class UserCardService extends APIManager {
    /** @private */
    #settings;
    /** @private */

    constructor() {
        super();
        this.setBaseUrl('https://darwina.pl/api');
    }

    async initialize(credentials) {
        if (!credentials?.token) {
            throw new Error('No access token provided', {
                type: ErrorType.AUTH_ERROR,
                severity: ErrorSeverity.CRITICAL
            });
        }
        this.setHeader('Authorization', `Bearer ${credentials.token}`);
    }

    async getUserCard(userId) {
        try {
            const response = await this.get(`/users/${userId}/card`);
            return this.transformUserCardData(response);
        } catch (error) {
            throw new Error(`Failed to fetch user card: ${error.message}`, {
                type: ErrorType.API_ERROR,
                severity: ErrorSeverity.HIGH
            });
        }
    }

    async updateUserCard(userId, cardData) {
        try {
            const response = await this.put(`/users/${userId}/card`, cardData);
            return this.transformUserCardData(response);
        } catch (error) {
            throw new Error(`Failed to update user card: ${error.message}`, {
                type: ErrorType.API_ERROR,
                severity: ErrorSeverity.HIGH
            });
        }
    }

    transformUserCardData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid user card data format', {
                type: ErrorType.DATA_ERROR,
                severity: ErrorType.HIGH
            });
        }
        return {
            id: data.id,
            userId: data.user_id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            role: data.role,
            permissions: data.permissions || [],
            settings: data.settings || {},
            lastActive: data.last_active ? new Date(data.last_active) : null
        };
    }

    /**
     * Initialize user card service
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing user card service...');
            
            // Load user card settings
            const storage = await this.getDependency('storage');
            const settings = await storage.get(USER_CARD_CONFIG.STORAGE_KEY) || {};
            this.#settings = { ...USER_CARD_CONFIG.DEFAULT_SETTINGS, ...settings };
            
            // Set up event listeners
            this.#setupEventListeners();
            
            this.log(LogLevel.SUCCESS, '✅ User card service initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }
} 
