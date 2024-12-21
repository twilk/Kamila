import { API_CONFIG } from '../config/api.config.js';
import { performanceMonitor } from './performance.js';

export class N8nService {
    static async request(endpoint, options = {}) {
        performanceMonitor.startMeasure('n8n-request');

        const config = {
            method: options.method || 'POST',
            headers: {
                ...API_CONFIG.HEADERS,
                ...options.headers
            },
            body: options.data ? JSON.stringify(options.data) : undefined
        };

        try {
            const response = await this.fetchWithRetry(
                `${API_CONFIG.N8N.BASE_URL}${endpoint}`,
                config
            );

            performanceMonitor.endMeasure('n8n-request');
            return await response.json();
        } catch (error) {
            performanceMonitor.endMeasure('n8n-request');
            throw this.handleError(error);
        }
    }

    static async fetchWithRetry(url, config, attempt = 1) {
        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return response;
        } catch (error) {
            if (attempt >= API_CONFIG.N8N.RETRY_ATTEMPTS) {
                throw error;
            }

            await new Promise(resolve => 
                setTimeout(resolve, API_CONFIG.N8N.RETRY_DELAY * attempt)
            );

            return this.fetchWithRetry(url, config, attempt + 1);
        }
    }

    static handleError(error) {
        // Map error types
        if (error.name === 'TypeError') {
            return new Error('Network error - check your connection');
        }

        if (error.message.includes('HTTP error!')) {
            return new Error('API error - service may be unavailable');
        }

        return error;
    }

    // Specific API methods
    static async triggerWorkflow(data) {
        return this.request(API_CONFIG.N8N.ENDPOINTS.WORKFLOW, {
            method: 'POST',
            data
        });
    }

    static async checkStatus() {
        return this.request(API_CONFIG.N8N.ENDPOINTS.STATUS, {
            method: 'GET'
        });
    }

    static async syncData(data) {
        return this.request(API_CONFIG.N8N.ENDPOINTS.SYNC, {
            method: 'POST',
            data
        });
    }
} 