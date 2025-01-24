import { BaseManager } from '../core/BaseManager.js';
import { LogLevel } from '../core/LogLevel.js';
import { ErrorType, ErrorSeverity } from '../core/ErrorTypes.js';
import { API_CONFIG } from '../../config/api.js';

/**
 * Service for managing orders from the DARWINA API
 * @extends BaseManager
 */
export class OrderService extends BaseManager {
    #credentials = null;
    #tokenRefreshPromise = null;
    #lastTokenRefresh = 0;
    #tokenRefreshInterval = 30 * 60 * 1000; // 30 minutes
    
    constructor(credentials) {
        super('OrderService');
        this.#validateAndSetCredentials(credentials);
    }
    
    /**
     * Validate and set credentials
     * @private
     * @param {Object} credentials API credentials
     * @throws {Error} If credentials are invalid
     */
    #validateAndSetCredentials(credentials) {
        if (!credentials) {
            throw new Error('Credentials are required');
        }
        
        this.log(LogLevel.DEBUG, '🔑 Validating credentials', {
            hasToken: !!credentials?.token,
            tokenLength: credentials?.token?.length
        });
        
        if (!credentials?.token) {
            throw new Error('API token is required');
        }
        
        this.#credentials = credentials;
        this.log(LogLevel.SUCCESS, '✅ Credentials validated successfully');
    }
    
    /**
     * Check if token needs refresh
     * @private
     * @returns {boolean}
     */
    #shouldRefreshToken() {
        return Date.now() - this.#lastTokenRefresh >= this.#tokenRefreshInterval;
    }
    
    /**
     * Refresh API token
     * @private
     * @returns {Promise<void>}
     */
    async #refreshToken() {
        if (this.#tokenRefreshPromise) {
            return this.#tokenRefreshPromise;
        }
        
        try {
            this.#tokenRefreshPromise = (async () => {
                this.log(LogLevel.INFO, '🔄 Refreshing API token...');
                
                const response = await fetch(`${API_CONFIG.DARWINA.BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.AUTH}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.#credentials.token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Token refresh failed: ${response.status}`);
                }
                
                const data = await response.json();
                this.#credentials.token = data.token;
                this.#lastTokenRefresh = Date.now();
                
                this.log(LogLevel.SUCCESS, '✅ API token refreshed successfully');
            })();
            
            await this.#tokenRefreshPromise;
        } catch (error) {
            this.handleError(error, ErrorType.AUTH, ErrorSeverity.HIGH, {
                method: '_refreshToken'
            });
            throw error;
        } finally {
            this.#tokenRefreshPromise = null;
        }
    }
    
    /**
     * Make authenticated API request
     * @private
     * @param {string} endpoint API endpoint
     * @param {Object} [options] Request options
     * @returns {Promise<Response>}
     */
    async #makeRequest(endpoint, options = {}) {
        try {
            if (!this.#credentials?.token) {
                throw new Error('No API token available');
            }

            // Temporarily disabled token refresh since we already have a valid token
            /*
            const tokenAge = Date.now() - this.#lastTokenRefresh;
            if (tokenAge > TOKEN_REFRESH_INTERVAL) {
                console.log('[DEBUG] 🔄 Token needs refresh, refreshing...');
                await this.#refreshToken();
            }
            */

            const response = await fetch(endpoint, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${this.#credentials.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            return response;
        } catch (error) {
            this.handleError(error, ErrorType.API, ErrorSeverity.MEDIUM, {
                method: '_makeRequest',
                endpoint
            });
            throw error;
        }
    }
    
    /**
     * Fetch orders from API
     * @param {Object} [store] Optional store filter
     * @returns {Promise<Array>} List of orders
     */
    async fetchOrders(store = null) {
        try {
            const params = new URLSearchParams();
            
            // Add store filter if provided
            if (store && store.id !== 'ALL' && store.deliveryId) {
                params.append('delivery_id', store.deliveryId);
            }

            // Add status filter for relevant statuses
            params.append('status_id', [1,2,3,5].join(','));
            
            // Add pagination and time filters
            params.append('limit', '50');
            params.append('page', '1');
            
            // Add modified_from filter (24h ago)
            const modifiedFrom = new Date(Date.now() - 24 * 60 * 60 * 1000);
            params.append('modified_from', modifiedFrom.toISOString());
            
            const queryString = params.toString();
            const fullEndpoint = `${API_CONFIG.DARWINA.BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}${queryString ? `?${queryString}` : ''}`;
            
            // Log request details
            console.log('[DEBUG] 🔍 API Request:', {
                url: fullEndpoint,
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer [REDACTED]',
                    'Content-Type': 'application/json'
                },
                store: store?.id || 'ALL',
                params: Object.fromEntries(params)
            });

            const response = await this.#makeRequest(fullEndpoint);
            
            // Log response status
            console.log('[DEBUG] 📥 API Response:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers)
            });

            const data = await response.json();
            
            // Check if we have more pages
            const totalPages = data.__metadata?.page_count || 1;
            let allOrders = [...(data.data || [])];

            // Fetch remaining pages if any
            for (let page = 2; page <= totalPages; page++) {
                params.set('page', page.toString());
                const nextEndpoint = `${API_CONFIG.DARWINA.BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}?${params.toString()}`;
                
                console.log(`[DEBUG] 📑 Fetching page ${page}/${totalPages}`);
                const nextResponse = await this.#makeRequest(nextEndpoint);
                const nextData = await nextResponse.json();
                
                if (nextData.data) {
                    allOrders = [...allOrders, ...nextData.data];
                }
            }
            
            // Log response data summary
            console.log('[DEBUG] 📊 Response Data:', {
                totalOrders: allOrders.length,
                firstOrderId: allOrders[0]?.id,
                lastOrderId: allOrders[allOrders.length - 1]?.id,
                store: store?.id || 'ALL',
                pages: totalPages
            });

            this.log(LogLevel.SUCCESS, '✅ Orders fetched successfully', {
                count: allOrders.length,
                store: store?.id || 'ALL'
            });
            
            return allOrders;
        } catch (error) {
            this.handleError(error, ErrorType.API, ErrorSeverity.MEDIUM, {
                method: 'fetchOrders',
                store: store?.id || 'ALL'
            });
            throw error;
        }
    }
    
    /**
     * Initialize the service
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            // No need to verify API connection since we don't have a health endpoint
            this.log(LogLevel.SUCCESS, '✅ Service initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
    }
    
    /**
     * Clean up service resources
     * @returns {Promise<boolean>}
     */
    async dispose() {
        try {
            this.#credentials = null;
            this.#tokenRefreshPromise = null;
            this.#lastTokenRefresh = 0;
            
            this.log(LogLevel.SUCCESS, '✅ Service disposed successfully');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
            return false;
        }
    }
    
    /**
     * Update service credentials
     * @param {Object} credentials API credentials
     */
    updateCredentials(credentials) {
        this.#validateAndSetCredentials(credentials);
        this.#lastTokenRefresh = Date.now(); // Reset token refresh timer
        this.log(LogLevel.INFO, '🔑 Credentials updated');
    }
} 