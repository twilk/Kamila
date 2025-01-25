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
     * @param {Object} [options] Additional options like modified_from
     * @returns {Promise<Array>} List of orders
     */
    async fetchOrders(store = null, options = {}) {
        try {
            const params = new URLSearchParams();
            
            // Add store filter if provided and not ALL
            if (store && store.id !== 'ALL' && store.deliveryId) {
                params.append('delivery_id', store.deliveryId);
                this.log(LogLevel.DEBUG, '🏪 Using store filter:', {
                    store_id: store.id,
                    delivery_id: store.deliveryId
                });
            }

            // Add status filter using STATUS_CODES
            const statusIds = [
                API_CONFIG.DARWINA.STATUS_CODES.SUBMITTED,
                API_CONFIG.DARWINA.STATUS_CODES.CONFIRMED,
                API_CONFIG.DARWINA.STATUS_CODES.ACCEPTED,
                API_CONFIG.DARWINA.STATUS_CODES.READY
            ].join(',');
            params.append('status_id', statusIds);
            
            // Add pagination
            params.append('limit', '50');
            params.append('page', '1');
            
            // Add modified_from filter only if it's not the first request
            // and we have valid cached data
            if (!options.isFirstRequest && options.modified_from) {
                const modifiedFrom = new Date(options.modified_from);
                params.append('modified_from', modifiedFrom.toISOString());
                this.log(LogLevel.DEBUG, '🕒 Using modified_from filter:', {
                    modified_from: modifiedFrom.toISOString()
                });
            }
            
            const queryString = params.toString();
            const fullEndpoint = `${API_CONFIG.DARWINA.BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}${queryString ? `?${queryString}` : ''}`;
            
            // Log request details
            this.log(LogLevel.DEBUG, '🔍 API Request:', {
                url: fullEndpoint,
                method: 'GET',
                params: Object.fromEntries(params),
                options,
                store: store?.id || 'ALL'
            });

            const response = await this.#makeRequest(fullEndpoint);
            const data = await response.json();
            
            // Log raw response data for debugging
            this.log(LogLevel.DEBUG, '📥 Raw API Response:', JSON.stringify({
                metadata: data.__metadata,
                firstRecord: data.data?.[0],
                totalRecords: data.data?.length,
                allRecords: data.data
            }, null, 2));

            // Check if we have more pages
            const totalPages = data.__metadata?.page_count || 1;
            let allOrders = [...(data.data || [])];

            // Fetch remaining pages if any
            for (let page = 2; page <= totalPages; page++) {
                params.set('page', page.toString());
                const nextEndpoint = `${API_CONFIG.DARWINA.BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}?${params.toString()}`;
                
                this.log(LogLevel.DEBUG, `📑 Fetching page ${page}/${totalPages}`);
                const nextResponse = await this.#makeRequest(nextEndpoint);
                const nextData = await nextResponse.json();
                
                if (nextData.data) {
                    allOrders = [...allOrders, ...nextData.data];
                }
            }

            // Transform orders before processing
            const transformedOrders = this.transformOrdersData(allOrders);
            this.log(LogLevel.DEBUG, '📦 Transformed orders:', JSON.stringify(transformedOrders, null, 2));

            // Calculate counts using STATUS_CODES
            const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
            const counts = {
                submitted: 0,
                confirmed: 0,
                accepted: 0,
                ready: 0,
                overdue: 0
            };

            transformedOrders.forEach(order => {
                const readyDate = new Date(order.ready_date || order.modified_at);
                
                switch (order.status_id) {
                    case API_CONFIG.DARWINA.STATUS_CODES.SUBMITTED:
                        counts.submitted++;
                        break;
                    case API_CONFIG.DARWINA.STATUS_CODES.CONFIRMED:
                        counts.confirmed++;
                        break;
                    case API_CONFIG.DARWINA.STATUS_CODES.ACCEPTED:
                        counts.accepted++;
                        break;
                    case API_CONFIG.DARWINA.STATUS_CODES.READY:
                        if (readyDate < twoWeeksAgo) {
                            counts.overdue++;
                        } else {
                            counts.ready++;
                        }
                        break;
                }
            });

            this.log(LogLevel.DEBUG, '📊 Final counts:', counts);
            return counts;
        } catch (error) {
            this.handleError(error, ErrorType.API, ErrorSeverity.HIGH, {
                method: 'fetchOrders',
                store,
                options
            });
            throw error;
        }
    }
    
    /**
     * Transform raw orders data into a consistent format
     * @private
     * @param {Array} orders Raw orders from API
     * @returns {Array} Transformed orders
     */
    transformOrdersData(orders) {
        return orders.map(order => ({
            id: order.order_id,
            status_id: order.status_id,
            status_name: this.getStatusName(order.status_id),
            customer: {
                name: order.customer_name,
                email: order.customer_email
            },
            items: order.items?.map(item => ({
                name: item.product_name,
                quantity: item.quantity,
                price: item.price
            })) || [],
            total: order.total_amount,
            created_at: order.created_at,
            modified_at: order.modified_at,
            ready_date: order.ready_date
        }));
    }
    
    /**
     * Get status name from status ID
     * @private
     * @param {number} statusId Status ID
     * @returns {string} Status name
     */
    getStatusName(statusId) {
        const statusMap = {
            [API_CONFIG.DARWINA.STATUS_CODES.SUBMITTED]: 'submitted',
            [API_CONFIG.DARWINA.STATUS_CODES.CONFIRMED]: 'confirmed',
            [API_CONFIG.DARWINA.STATUS_CODES.ACCEPTED]: 'accepted',
            [API_CONFIG.DARWINA.STATUS_CODES.READY]: 'ready'
        };
        return statusMap[statusId] || 'unknown';
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