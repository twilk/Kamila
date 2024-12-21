import { requestLimiter } from './request.limiter.js';
import { REQUEST_LIMITS } from '../config/request.limits.js';

/**
 * Bazowy serwis do komunikacji z API
 */
export class ApiService {
    constructor() {
        this.baseUrl = 'https://api.darwina.pl/v1';
        this.limiter = requestLimiter;
    }

    /**
     * Wykonuje request do API
     * @param {Object} config - Konfiguracja requestu
     */
    async request(config) {
        const { 
            endpoint, 
            method = 'GET', 
            data, 
            priority = REQUEST_LIMITS.priority.MEDIUM,
            useCache = true
        } = config;

        const cacheKey = useCache ? `${method}:${endpoint}` : null;
        
        const requestConfig = {
            url: `${this.baseUrl}${endpoint}`,
            options: {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Client-Version': '1.2.0'
                },
                body: data ? JSON.stringify(data) : undefined
            },
            priority,
            cacheKey,
            timeout: method === 'GET' ? 10000 : 30000 // Krótszy timeout dla GET
        };

        try {
            return await this.limiter.executeRequest(requestConfig);
        } catch (error) {
            if (error.code === 'RATE_LIMIT_EXCEEDED') {
                console.warn(`API rate limit exceeded for ${endpoint}`);
                // Dodaj do kolejki z automatycznym ponawianiem
                return this.limiter.addToQueueWithRetry(
                    () => this.limiter.executeRequest(requestConfig)
                );
            }
            throw this.handleApiError(error);
        }
    }

    /**
     * Wykonuje request z wysokim priorytetem
     */
    async criticalRequest(config) {
        return this.request({
            ...config,
            priority: REQUEST_LIMITS.priority.CRITICAL,
            useCache: false // Krytyczne requesty zawsze świeże
        });
    }

    /**
     * Wykonuje request w tle z niskim priorytetem
     */
    async backgroundRequest(config) {
        return this.request({
            ...config,
            priority: REQUEST_LIMITS.priority.LOW
        }).catch(error => {
            console.warn('Background request failed:', error);
            return null; // Ciche niepowodzenie dla requestów w tle
        });
    }

    /**
     * Przetwarza błędy API
     */
    handleApiError(error) {
        const apiError = new Error(error.message);
        apiError.code = error.code || 'API_ERROR';
        apiError.status = error.status;
        apiError.endpoint = error.config?.url;
        return apiError;
    }

    /**
     * Czyści cache dla danego endpointu
     */
    clearCache(endpoint) {
        if (endpoint) {
            this.limiter.cache.delete(`GET:${endpoint}`);
        } else {
            this.limiter.clearCache();
        }
    }

    /**
     * Zwraca statystyki requestów
     */
    getRequestStats() {
        return this.limiter.getStats();
    }
}

// Singleton instance
export const apiService = new ApiService(); 