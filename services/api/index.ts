import { BaseManager } from '../core/BaseManager';
import { LogManager } from '../core/LogManager';
import { CacheManager } from '../core/CacheManager';
import { ErrorHandler } from '../core/ErrorHandler';

interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    params?: Record<string, any>;
    timeout?: number;
}

class APIManager extends BaseManager {
    private static _instance: APIManager | null = null;
    private _baseURL: string = process.env.API_URL || 'https://api.darwina.pl/v1';
    private _apiKey: string = process.env.API_KEY || '';
    private _logger = LogManager.getInstance();
    private _cache = CacheManager.getInstance();
    private _errorHandler = ErrorHandler.getInstance();

    public static getInstance(): APIManager {
        if (!APIManager._instance) {
            APIManager._instance = new APIManager();
        }
        return APIManager._instance;
    }

    private constructor() {
        if (APIManager._instance) {
            throw new Error('Use APIManager.getInstance()');
        }
        super();
    }

    public async request(endpoint: string, options: RequestOptions = {}): Promise<any> {
        try {
            const cacheKey = this._generateCacheKey(endpoint, options);
            const cachedResponse = await this._cache.get(cacheKey);
            
            if (cachedResponse) {
                this._logger.debug('Returning cached response', { endpoint });
                return cachedResponse;
            }

            const response = await this._makeRequest(endpoint, options);
            await this._cache.set(cacheKey, response);
            return response;
        } catch (error) {
            this._errorHandler.handle(error);
            throw error;
        }
    }

    private _generateCacheKey(endpoint: string, options: RequestOptions): string {
        return `api:${endpoint}:${JSON.stringify(options)}`;
    }

    private async _makeRequest(endpoint: string, options: RequestOptions = {}): Promise<any> {
        const url = `${this._baseURL}${endpoint}`;
        const defaultOptions: RequestOptions = {
            headers: {
                'Authorization': `Bearer ${this._apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: process.env.REQUEST_TIMEOUT ? parseInt(process.env.REQUEST_TIMEOUT) : 5000
        };

        const requestOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        this._logger.debug('Making API request', { url, options: requestOptions });

        try {
            const response = await fetch(url, requestOptions);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.statusText}`);
            }

            const data = await response.json();
            this._logger.debug('API request successful', { endpoint, data });
            return data;
        } catch (error) {
            this._logger.error('API request failed', error);
            throw error;
        }
    }

    // User endpoints
    public async getUserData(userId: string): Promise<any> {
        return this.request(`/users/${userId}`);
    }

    public async updateUserData(userId: string, data: any): Promise<any> {
        return this.request(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // Store endpoints
    public async getStoreData(storeId: string): Promise<any> {
        return this.request(`/stores/${storeId}`);
    }

    public async updateStoreData(storeId: string, data: any): Promise<any> {
        return this.request(`/stores/${storeId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // Ranking endpoints
    public async getRankingData(params: Record<string, any>): Promise<any> {
        return this.request('/rankings', {
            method: 'GET',
            params
        });
    }

    public async updateRanking(rankingId: string, data: any): Promise<any> {
        return this.request(`/rankings/${rankingId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // Report endpoints
    public async generateReport(params: Record<string, any>): Promise<any> {
        return this.request('/reports/generate', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    }

    public async getReportStatus(reportId: string): Promise<any> {
        return this.request(`/reports/${reportId}/status`);
    }

    // Metrics endpoints
    public async sendMetrics(data: Record<string, any>): Promise<any> {
        return this.request('/metrics', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    public async getMetrics(params: Record<string, any>): Promise<any> {
        return this.request('/metrics', {
            method: 'GET',
            params
        });
    }
}

export const API = APIManager.getInstance(); 