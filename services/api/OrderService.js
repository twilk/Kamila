import { BaseManager } from '../core/BaseManager.js';
import { LogLevel } from '../core/LogLevel.js';
import { ErrorType, ErrorSeverity } from '../core/ErrorTypes.js';
import { API_CONFIG } from '../../config/api.js';
import { StorageManager } from '../core/StorageManager.js';
import { stores } from '../stores.js';

// Add at the top of the file, after imports
const ORDER_STATUSES = {
    NEW: '1',
    CONFIRMED: '2',
    ACCEPTED: '3',
    READY_FOR_PICKUP: '5'
};

const ORDER_STATUS_NAMES = {
    [ORDER_STATUSES.NEW]: 'Nowe',
    [ORDER_STATUSES.CONFIRMED]: 'Potwierdzone telefonicznie przez sklep',
    [ORDER_STATUSES.ACCEPTED]: 'Przyjęte do realizacji',
    [ORDER_STATUSES.READY_FOR_PICKUP]: 'Gotowe do odbioru'
};

const COUNTER_KEYS = {
    NEW: '1',
    CONFIRMED: '2',
    ACCEPTED: '3',
    READY: 'READY',
    OVERDUE: 'OVERDUE'
};

// Add at the top with other constants
const DATE_FIELDS = {
    READY: ['ready_date', 'status_change_date', 'modified_at', 'date', 'created_at'],
    DEFAULT: ['date', 'created_at', 'modified_at']
};

// Add at the top with other constants
const CACHE_KEYS = {
    ORDER_COUNTS: 'orderCounts',
    LAST_UPDATE: 'lastUpdate',
    STORE_PREFIX: 'store_'
};

const CACHE_SCHEMA = {
    counts: {
        [COUNTER_KEYS.NEW]: 'number',
        [COUNTER_KEYS.CONFIRMED]: 'number',
        [COUNTER_KEYS.ACCEPTED]: 'number',
        [COUNTER_KEYS.READY]: 'number',
        [COUNTER_KEYS.OVERDUE]: 'number'
    },
    timestamp: 'number',
    storeId: 'string',
    metadata: {
        store: 'string',
        total: 'number',
        processedAt: 'number',
        forceRefresh: 'boolean',
        originalFormat: 'object'
    }
};

// Add at the top with other constants
const API_DEFAULTS = {
    LIMIT: 50,
    STATUSES: '1,2,3,5'
};

// Add lock mechanism
const LOCKS = {
    cache: new Map()
};

/**
 * Service for managing orders from the DARWINA API
 * @extends BaseManager
 */
export class OrderService extends BaseManager {
    #credentials = null;
    #tokenRefreshPromise = null;
    #lastTokenRefresh = 0;
    #tokenRefreshInterval = 30 * 60 * 1000; // 30 minutes
    #storage = null;
    #hasInitialData = false;
    
    constructor(credentials) {
        super('OrderService');
        this.#validateAndSetCredentials(credentials);
        this.#storage = StorageManager.getInstance();
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
     * Fetch all orders with pagination
     * @private
     * @param {Object} params Base parameters for the request
     * @returns {Promise<Array>} All fetched orders
     */
    async #fetchAllPages(params) {
        let allOrders = [];
        let currentPage = 1;
        let hasMorePages = true;
        let totalPages = 0;
        let totalOrders = 0;

        // Ensure we're using all required statuses
        const requestParams = {
            ...params,
            status_id: '1,2,3,5', // Always use all statuses in one request
            limit: params.limit || API_DEFAULTS.LIMIT
        };

        this.log(LogLevel.INFO, '📑 Starting pagination fetch', {
            initialFetch: !this.#hasInitialData,
            params: requestParams,
            baseUrl: `${API_CONFIG.DARWINA.BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}`
        });

        while (hasMorePages) {
            const url = new URL(`${API_CONFIG.DARWINA.BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}`);
            
            // Add all parameters including status_id with all statuses
            Object.entries(requestParams).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.append(key, value.toString());
                }
            });

            // Add pagination parameters
            url.searchParams.append('page', currentPage.toString());

            this.log(LogLevel.DEBUG, `📄 Fetching page ${currentPage}`, {
                url: url.toString(),
                params: Object.fromEntries(url.searchParams)
            });

            const response = await this.#makeRequest(url.toString());
            const responseData = await response.json();

            if (!responseData.data || !Array.isArray(responseData.data)) {
                throw new Error('Invalid API response format');
            }

            // Update pagination info from first response
            if (currentPage === 1) {
                totalPages = responseData.metadata?.page_count || 1;
                totalOrders = responseData.metadata?.total || responseData.data.length;
                this.log(LogLevel.INFO, '📊 Pagination info received', {
                    totalPages,
                    totalOrders,
                    pageSize: API_DEFAULTS.LIMIT,
                    metadata: responseData.metadata
                });
            }

            const pageOrders = responseData.data;
            
            // Log status breakdown for this page
            const pageStatusBreakdown = pageOrders.reduce((acc, order) => {
                const status = order.status_id?.toString();
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, {});

            this.log(LogLevel.DEBUG, `📦 Fetched page ${currentPage}/${totalPages}`, {
                ordersOnPage: pageOrders.length,
                totalOrdersSoFar: allOrders.length + pageOrders.length,
                expectedTotal: totalOrders,
                pageStatusBreakdown
            });

            allOrders = [...allOrders, ...pageOrders];
            
            // Check if we have more pages
            hasMorePages = currentPage < totalPages;
            currentPage++;
        }

        // Final status breakdown
        const finalStatusBreakdown = allOrders.reduce((acc, order) => {
            const status = order.status_id?.toString();
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});

        this.log(LogLevel.SUCCESS, '✅ Pagination fetch completed', {
            totalPages,
            totalOrdersFetched: allOrders.length,
            expectedTotal: totalOrders,
            matchesExpected: allOrders.length === totalOrders,
            finalStatusBreakdown
        });

        return allOrders;
    }
    
    /**
     * Fetch orders from API
     * @param {string} storeId Store ID to fetch orders for
     * @param {Object} [options] Additional options
     * @param {boolean} [options.forceRefresh] Whether to force full refresh without modified_from
     * @returns {Promise<Object>} Processed order data
     */
    async fetchOrders(storeId = 'ALL', options = {}) {
        try {
            // Check cache first (unless forcing refresh)
            if (!options.forceRefresh) {
                const cached = await this.#checkCache(storeId);
                if (cached) {
                    this.log(LogLevel.DEBUG, '📦 Using cached data', {
                        storeId,
                        cacheAge: Date.now() - cached.timestamp
                    });
                    return cached;
                }
            }

            this.log(LogLevel.DEBUG, '📡 Fetching orders', {
                storeId,
                hasInitialData: this.#hasInitialData,
                options
            });
            
            // Prepare base parameters
            const params = {};
            
            // Add status_id filter
            params.status_id = API_DEFAULTS.STATUSES;
            
            // Add delivery_id if specific store
            if (storeId !== 'ALL') {
                const store = stores.find(s => s.id === storeId);
                if (store?.deliveryId) {
                    params.delivery_id = store.deliveryId;
                    this.log(LogLevel.DEBUG, '🏪 Using delivery_id filter', {
                        storeId,
                        deliveryId: store.deliveryId
                    });
                }
            }
            
            // Add modified_from ONLY if we have initial data and not forcing refresh
            if (!options.forceRefresh && this.#hasInitialData) {
                const lastUpdate = await this.#storage.load(CACHE_KEYS.LAST_UPDATE);
                if (lastUpdate) {
                    params.modified_from = new Date(lastUpdate).toISOString();
                    this.log(LogLevel.DEBUG, '⌚ Using modified_from filter', {
                        lastUpdate: params.modified_from
                    });
                }
            }
            
            // Fetch all pages
            const orders = await this.#fetchAllPages(params);
            
            // Process orders
            const result = await this.#processOrders(orders, { id: storeId });
            
            // Update cache
            await this.#updateCache(storeId, result);
            
            // Mark that we have initial data
            this.#hasInitialData = true;
            
            return result;
        } catch (error) {
            this.handleError(error, ErrorType.API, ErrorSeverity.HIGH, {
                method: 'fetchOrders',
                storeId
            });
            throw error;
        }
    }
    
    /**
     * Process fetched orders
     * @private
     * @param {Array} orders Raw orders from API
     * @param {Object} store Store filter used
     * @returns {Promise<Object>} Processed order data
     */
    async #processOrders(orders, store) {
        try {
            const counts = {
                [COUNTER_KEYS.NEW]: 0,
                [COUNTER_KEYS.CONFIRMED]: 0,
                [COUNTER_KEYS.ACCEPTED]: 0,
                [COUNTER_KEYS.READY]: 0,
                [COUNTER_KEYS.OVERDUE]: 0
            };

            this.log(LogLevel.INFO, '📊 Starting order processing', {
                totalOrders: orders.length,
                initialFetch: !this.#hasInitialData,
                storeId: store?.id || 'ALL'
            });

            const statusBreakdown = {};
            const readyOrders = [];
            const overdueOrders = [];

            for (const order of orders) {
                const status = order.status_id?.toString();
                
                if (!status) {
                    this.log(LogLevel.WARNING, '⚠️ Order without status', order);
                    continue;
                }

                // Track status breakdown
                statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

                if (status === ORDER_STATUSES.READY_FOR_PICKUP) {
                    const dateToCheck = order.ready_date || order.created_at;

                    if (!dateToCheck) {
                        this.log(LogLevel.WARNING, '⚠️ No valid date for READY order', {
                    id: order.order_id,
                            availableFields: Object.keys(order).filter(k => k.includes('date') || k.includes('_at'))
                        });
                        counts[COUNTER_KEYS.READY]++;
                        readyOrders.push({ id: order.order_id, reason: 'no_date' });
                    continue;
                }
                
                    try {
                        const orderDate = new Date(dateToCheck.replace(' ', 'T'));
                        if (isNaN(orderDate.getTime())) {
                            throw new Error('Invalid date');
                        }
                        
                        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
                        const ageInDays = Math.floor((Date.now() - orderDate.getTime()) / (24 * 60 * 60 * 1000));
                        
                        if (orderDate < twoWeeksAgo) {
                            counts[COUNTER_KEYS.OVERDUE]++;
                            overdueOrders.push({
                                id: order.order_id,
                                date: dateToCheck,
                                age: ageInDays
                            });
                        } else {
                            counts[COUNTER_KEYS.READY]++;
                            readyOrders.push({
                                id: order.order_id,
                                date: dateToCheck,
                                age: ageInDays
                            });
                        }
                    } catch (error) {
                        this.log(LogLevel.WARNING, '⚠️ Invalid date for order', {
                            id: order.order_id,
                            date: dateToCheck,
                            error: error.message
                        });
                        counts[COUNTER_KEYS.READY]++;
                        readyOrders.push({ id: order.order_id, reason: 'invalid_date' });
                    }
                } else if ([ORDER_STATUSES.NEW, ORDER_STATUSES.CONFIRMED, ORDER_STATUSES.ACCEPTED].includes(status)) {
                    counts[status]++;
                } else {
                    this.log(LogLevel.WARNING, '⚠️ Unhandled status', {
                        id: order.order_id,
                        status,
                        availableStatuses: Object.keys(ORDER_STATUS_NAMES)
                    });
                }
            }

            this.log(LogLevel.INFO, '📊 Processing completed', {
                counts,
                total: Object.values(counts).reduce((a, b) => a + b, 0),
                statusBreakdown,
                readyVsOverdue: {
                    ready: counts[COUNTER_KEYS.READY],
                    overdue: counts[COUNTER_KEYS.OVERDUE],
                    total: statusBreakdown['5'] || 0
                },
                readyOrders: readyOrders.length > 10 ? `${readyOrders.length} orders` : readyOrders,
                overdueOrders: overdueOrders.length > 10 ? `${overdueOrders.length} orders` : overdueOrders
            });

            return {
                orders,
                counts,
                timestamp: Date.now(),
                storeId: store?.id || 'ALL',
                metadata: {
                    total: orders.length,
                    processedAt: Date.now(),
                    initialFetch: !this.#hasInitialData,
                    statusBreakdown,
                    readyCount: readyOrders.length,
                    overdueCount: overdueOrders.length
                }
            };
        } catch (error) {
            this.handleError(error, ErrorType.PROCESSING, ErrorSeverity.HIGH, {
                method: '_processOrders',
                ordersCount: orders?.length
            });
            throw error;
        }
    }

    /**
     * Get cache key for store
     * @private
     * @param {string} storeId Store ID
     * @returns {string} Cache key
     */
    #getCacheKey(storeId) {
        return `${CACHE_KEYS.ORDER_COUNTS}_${storeId || 'ALL'}`;
    }

    /**
     * Get lock for operation
     * @private
     * @param {string} key Operation key
     * @returns {Promise<void>}
     */
    async #getLock(key) {
        while (LOCKS.cache.has(key)) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        LOCKS.cache.set(key, Date.now());
    }

    /**
     * Release lock for operation
     * @private
     * @param {string} key Operation key
     */
    #releaseLock(key) {
        LOCKS.cache.delete(key);
    }

    /**
     * Update cache with processed order data
     * @private
     * @param {string} storeId Store ID to update cache for
     * @param {Object} data Processed order data
     * @returns {Promise<void>}
     */
    async #updateCache(storeId, data) {
        const key = this.#getCacheKey(storeId);
        try {
            await this.#getLock(key);
            
            this.log(LogLevel.DEBUG, '💾 Updating cache', {
                key,
                storeId,
                dataTimestamp: data.timestamp,
                initialFetch: !this.#hasInitialData,
                counts: data.counts,
                metadata: data.metadata
            });
            
            const cacheData = {
                counts: {
                    [COUNTER_KEYS.NEW]: Number(data.counts[COUNTER_KEYS.NEW]) || 0,
                    [COUNTER_KEYS.CONFIRMED]: Number(data.counts[COUNTER_KEYS.CONFIRMED]) || 0, 
                    [COUNTER_KEYS.ACCEPTED]: Number(data.counts[COUNTER_KEYS.ACCEPTED]) || 0,
                    [COUNTER_KEYS.READY]: Number(data.counts[COUNTER_KEYS.READY]) || 0,
                    [COUNTER_KEYS.OVERDUE]: Number(data.counts[COUNTER_KEYS.OVERDUE]) || 0
                },
                timestamp: Number(data.timestamp) || Date.now(),
                storeId: String(storeId || 'ALL'),
                metadata: {
                    store: String(storeId || 'ALL'),
                    total: Object.values(data.counts).reduce((sum, val) => sum + Number(val), 0),
                    processedAt: Number(data.metadata?.processedAt) || Date.now(),
                    forceRefresh: Boolean(data.metadata?.forceRefresh),
                    originalFormat: Array.from(new Set(Object.keys(data.counts))),
                    initialFetch: !this.#hasInitialData
                }
            };

            this.#validateCacheData(cacheData);

            // Atomic update of both cache and timestamp
            await Promise.all([
                this.#storage.save(key, cacheData),
                this.#storage.save(CACHE_KEYS.LAST_UPDATE, Date.now())
            ]);

            this.log(LogLevel.SUCCESS, '✅ Cache updated successfully', {
                key,
                counts: cacheData.counts,
                total: cacheData.metadata.total,
                timestamp: new Date(cacheData.timestamp).toISOString(),
                lastUpdate: new Date(Date.now()).toISOString()
            });

            // Verify the data was saved
            const savedData = await this.#storage.load(key);
            const lastUpdate = await this.#storage.load(CACHE_KEYS.LAST_UPDATE);
            
            this.log(LogLevel.DEBUG, '🔍 Cache verification', {
                key,
                dataExists: !!savedData,
                lastUpdateExists: !!lastUpdate,
                savedCounts: savedData?.counts,
                savedTimestamp: savedData ? new Date(savedData.timestamp).toISOString() : null,
                lastUpdateTimestamp: lastUpdate ? new Date(lastUpdate).toISOString() : null
            });

            return cacheData;
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.MEDIUM, {
                method: '_updateCache',
                storeId
            });
            throw error;
        } finally {
            this.#releaseLock(key);
        }
    }
    
    /**
     * Validate cache data against schema
     * @private
     * @param {Object} data Cache data to validate
     * @throws {Error} If validation fails
     */
    #validateCacheData(data) {
        const validateType = (value, expectedType) => {
            if (expectedType === 'number') return typeof Number(value) === 'number' && !isNaN(Number(value));
            if (expectedType === 'string') return typeof String(value) === 'string';
            if (expectedType === 'boolean') return typeof Boolean(value) === 'boolean';
            if (expectedType === 'object') return value && typeof value === 'object';
            return false;
        };

        const validateObject = (obj, schema) => {
            for (const [key, expectedType] of Object.entries(schema)) {
                if (typeof expectedType === 'object') {
                    if (!obj[key] || typeof obj[key] !== 'object') {
                        throw new Error(`Invalid type for ${key}: expected object`);
                    }
                    validateObject(obj[key], expectedType);
                } else if (!validateType(obj[key], expectedType)) {
                    throw new Error(`Invalid type for ${key}: expected ${expectedType}, got ${typeof obj[key]}`);
                }
            }
        };

        validateObject(data, CACHE_SCHEMA);
    }
    
    /**
     * Validate and get cache if available
     * @private
     * @param {string} storeId Store ID to validate cache for
     * @returns {Promise<Object|null>} Cache data or null if invalid
     */
    async #checkCache(storeId) {
        const key = this.#getCacheKey(storeId);
        try {
            await this.#getLock(key);
            
            const [cache, lastUpdate] = await Promise.all([
                this.#storage.load(key),
                this.#storage.load(CACHE_KEYS.LAST_UPDATE)
            ]);

            if (!cache) return null;

            const now = Date.now();
            const cacheAge = now - cache.timestamp;
            const TTL = 5 * 60 * 1000;

            if (cacheAge > TTL) {
                await this.#storage.remove(key);
                return null;
            }

            // Validate format and required fields
            try {
                this.#validateCacheData(cache);
            } catch (error) {
                this.log(LogLevel.WARNING, '⚠️ Invalid cache format', { error });
                await this.#storage.remove(key);
                return null;
            }

            this.log(LogLevel.DEBUG, '✅ Using valid cache', {
                key,
                age: cacheAge,
                ttl: TTL,
                remaining: TTL - cacheAge
            });

            return cache;
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.LOW, {
                method: '_checkCache',
                storeId
            });
            return null;
        } finally {
            this.#releaseLock(key);
        }
    }

    /**
     * Clear all caches
     */
    async clearAllCaches() {
        try {
            // Get all cache keys
            const allKeys = await this.#storage.keys();
            const orderKeys = allKeys.filter(key => 
                key.startsWith(CACHE_KEYS.ORDER_COUNTS) || 
                key === CACHE_KEYS.LAST_UPDATE
            );

            // Clear all caches atomically
            await Promise.all(
                orderKeys.map(key => this.#storage.remove(key))
            );

            this.log(LogLevel.SUCCESS, '✅ All caches cleared', {
                clearedKeys: orderKeys
            });
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.LOW, {
                method: 'clearAllCaches'
            });
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
        return ORDER_STATUS_NAMES[statusId] || 'Nieznany';
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