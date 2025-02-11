import { APIManager } from './index.js';
import { ErrorType, ErrorSeverity } from '../core/ErrorTypes.js';

const apiManager = APIManager.getInstance();

export class UserCardService extends APIManager {
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
} 