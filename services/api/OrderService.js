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
        originalFormat: 'object',
        initialFetch: 'boolean',
        statusBreakdown: 'object',
        readyCount: 'number',
        overdueCount: 'number',
        processingTime: 'number',
        uniqueOrders: 'number'
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
class OrderService extends BaseManager {
    #credentials = null;
    #tokenRefreshPromise = null;
    #lastTokenRefresh = 0;
    #tokenRefreshInterval = 30 * 60 * 1000; // 30 minutes
    #storage = null;
    #hasInitialData = false;
    static #instance = null;
    static _registry = null;
    
    constructor(registry) {
        if (OrderService.#instance) {
            return OrderService.#instance;
        }
        super(registry, 'order');
        OrderService.#instance = this;
        OrderService._registry = registry;
        this.#storage = StorageManager.getInstance();
        
        // Add dependencies
        this.addDependency('storage');
        this.addDependency('api');
        this.addDependency('error');
    }
    
    static getInstance() {
        if (!OrderService.#instance) {
            throw new Error('OrderService not initialized');
        }
        return OrderService.#instance;
    }

    static setRegistry(registry) {
        OrderService._registry = registry;
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

            const url = endpoint.startsWith('http') ? endpoint : `${API_CONFIG.DARWINA.BASE_URL}${endpoint}`;

            this.log(LogLevel.DEBUG, '🔄 Making API request', {
                endpoint,
                url,
                method: options.method || 'GET',
                hasBody: !!options.body
            });

            const response = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${this.#credentials.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.log(LogLevel.ERROR, '❌ API request failed', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText,
                    endpoint,
                    url
                });
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            // Validate content type
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`Invalid content type: ${contentType}`);
            }

            this.log(LogLevel.DEBUG, '✅ API request successful', {
                endpoint,
                url,
                status: response.status,
                contentType,
                contentLength: response.headers.get('content-length')
            });

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
        const allOrders = [];
        let currentPage = 1;
        let hasMorePages = true;
        let totalPages = 0;
        let totalOrders = 0;
        let failedPages = [];
        const maxRetries = 3;
        let consecutiveFailures = 0;
        const MAX_CONSECUTIVE_FAILURES = 3;

        const requestParams = {
            ...params,
            limit: params.limit || API_DEFAULTS.LIMIT
        };

        this.log(LogLevel.INFO, '📑 Starting pagination fetch', {
            initialFetch: !this.#hasInitialData,
            params: requestParams,
            status: requestParams.status_id
        });

        const startTime = Date.now();
        const pageTimings = [];

        while (hasMorePages) {
            const pageStartTime = Date.now();
            const url = new URL(`${API_CONFIG.DARWINA.BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}`);
            
            // Add all parameters except page
            Object.entries(requestParams).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.append(key, value.toString());
                }
            });

            // Add page parameter
            url.searchParams.append('page', currentPage.toString());

            let retryCount = 0;
            let pageData = null;
            let lastError = null;

            while (retryCount < maxRetries && !pageData) {
                try {
                    const response = await this.#makeRequest(url.toString());
                    const responseData = await response.json();

                    // Validate response structure
                    if (!responseData || typeof responseData !== 'object') {
                        throw new Error('Invalid response format: not an object');
                    }

                    // Log raw response for debugging
                    this.log(LogLevel.DEBUG, `📄 Raw API response for page ${currentPage}`, {
                        status: requestParams.status_id,
                        hasData: !!responseData?.data,
                        dataType: responseData?.data ? typeof responseData.data : 'undefined',
                        dataLength: Array.isArray(responseData?.data) ? responseData.data.length : 'not array',
                        hasMetadata: !!responseData?.__metadata,
                        metadataKeys: responseData?.__metadata ? Object.keys(responseData.__metadata) : [],
                        responseKeys: Object.keys(responseData || {}),
                        statusCode: responseData?.statuscode,
                        contentLength: response.headers.get('content-length'),
                        contentType: response.headers.get('content-type')
                    });

                    // Check for empty response with metadata
                    if (responseData?.data === null && responseData?.__metadata) {
                        this.log(LogLevel.INFO, `📭 Empty page ${currentPage} for status ${requestParams.status_id}`);
                        pageData = { 
                            data: [], 
                            metadata: responseData.__metadata,
                            statuscode: responseData.statuscode 
                        };
                        consecutiveFailures = 0;
                        break;
                    }

                    // Validate data array
                    if (!Array.isArray(responseData?.data)) {
                        throw new Error(`Invalid data format: ${responseData?.data ? typeof responseData.data : 'missing'}`);
                    }

                    // Validate metadata
                    if (!responseData?.__metadata) {
                        throw new Error('Missing __metadata in response');
                    }

                    pageData = {
                        data: responseData.data,
                        metadata: responseData.__metadata,
                        statuscode: responseData.statuscode
                    };
                    consecutiveFailures = 0;

                } catch (error) {
                    lastError = error;
                    retryCount++;
                    
                    this.log(LogLevel.WARNING, `⚠️ Attempt ${retryCount}/${maxRetries} failed for page ${currentPage}`, {
                        status: requestParams.status_id,
                        error: error.message,
                        url: url.toString()
                    });

                    if (retryCount === maxRetries) {
                        consecutiveFailures++;
                        failedPages.push(currentPage);

                        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                            this.log(LogLevel.ERROR, `🛑 Stopping pagination due to ${consecutiveFailures} consecutive failures`, {
                                status: requestParams.status_id,
                                lastError: lastError.message
                            });
                            hasMorePages = false;
                            break;
                        }
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }

            if (!pageData) {
                currentPage++;
                continue;
            }

            // Process page data
            const pageOrders = pageData.data;
            allOrders.push(...pageOrders);

            // Update pagination info
            if (currentPage === 1) {
                totalPages = parseInt(pageData.metadata?.page_count, 10) || 1;
                totalOrders = parseInt(pageData.metadata?.total, 10) || pageOrders.length;
                
                this.log(LogLevel.INFO, `📊 Found ${totalOrders} orders for status ${requestParams.status_id}`, {
                    totalPages,
                    pageSize: requestParams.limit,
                    metadata: pageData.metadata
                });

                if (totalPages === 0 || totalOrders === 0) {
                    break;
                }
            }

            const pageTime = Date.now() - pageStartTime;
            pageTimings.push(pageTime);

            this.log(LogLevel.DEBUG, `📄 Processing page ${currentPage}/${totalPages}`, {
                status: requestParams.status_id,
                ordersOnPage: pageOrders.length,
                totalSoFar: allOrders.length,
                pageTime,
                averagePageTime: pageTimings.reduce((a, b) => a + b, 0) / pageTimings.length
            });

            hasMorePages = currentPage < totalPages && pageOrders.length > 0;
            currentPage++;

            if (hasMorePages) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        const totalTime = Date.now() - startTime;

        this.log(LogLevel.SUCCESS, `✅ Completed fetching orders for status ${requestParams.status_id}`, {
            totalPages,
            fetchedPages: currentPage - 1,
            failedPages,
            totalOrdersFetched: allOrders.length,
            expectedTotal: totalOrders,
            totalTime,
            averageTimePerPage: totalTime / (currentPage - 1),
            consecutiveFailures
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
            const baseParams = {
                limit: API_DEFAULTS.LIMIT
            };
            
            // Add delivery_id if specific store
            if (storeId !== 'ALL') {
                const store = stores.find(s => s.id === storeId);
                if (store?.deliveryId) {
                    baseParams.delivery_id = store.deliveryId;
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
                    baseParams.modified_from = new Date(lastUpdate).toISOString();
                    this.log(LogLevel.DEBUG, '⌚ Using modified_from filter', {
                        lastUpdate: baseParams.modified_from
                    });
                }
            }

            let allOrders = [];
            const statusGroups = API_DEFAULTS.STATUSES.split(',');
            
            this.log(LogLevel.INFO, '📑 Starting orders fetch', {
                statusGroups,
                baseParams
            });

            for (const statusGroup of statusGroups) {
                try {
                    const params = {
                        ...baseParams,
                        status_id: statusGroup
                    };
                    
                    const statusOrders = await this.#fetchAllPages(params);
                    allOrders.push(...statusOrders);
                    
                    this.log(LogLevel.DEBUG, `✅ Fetched orders for status ${statusGroup}`, {
                        count: statusOrders.length,
                        total: allOrders.length
                    });
                } catch (error) {
                    this.log(LogLevel.ERROR, `❌ Failed to fetch orders for status ${statusGroup}`, {
                        error: error.message
                    });
                }
            }

            // Process orders
            const result = await this.#processOrders(allOrders, { id: storeId });
            
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
                uniqueOrders: new Set(orders.map(o => o.order_id || o.id)).size,
                initialFetch: !this.#hasInitialData,
                storeId: store?.id || 'ALL'
            });

            const statusBreakdown = {};
            const readyOrders = [];
            const overdueOrders = [];
            const processedOrders = []; // Array to store processed orders
            const ordersByStatus = new Map();
            const startTime = Date.now();

            for (const order of orders) {
                const status = order.status_id?.toString();
                
                if (!status) {
                    this.log(LogLevel.WARNING, '⚠️ Order without status', order);
                    continue;
                }

                // Keep track of orders by status
                if (!ordersByStatus.has(status)) {
                    ordersByStatus.set(status, []);
                }
                ordersByStatus.get(status).push(order.order_id || order.id);

                // Transform order data
                const processedOrder = this.transformOrdersData([order])[0];
                processedOrders.push(processedOrder);

                // Track status breakdown
                statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

                if (status === ORDER_STATUSES.READY_FOR_PICKUP) {
                    // Try all possible date fields in order of preference
                    const dateFields = ['ready_date', 'status_change_date', 'modified_at', 'created_at', 'date'];
                    let dateToCheck = null;
                    
                    for (const field of dateFields) {
                        if (order[field]) {
                            dateToCheck = order[field];
                            break;
                        }
                    }

                    // If no date is found, use current date and add to READY
                    if (!dateToCheck) {
                        counts[COUNTER_KEYS.READY]++;
                        readyOrders.push({ 
                            id: order.order_id || order.id, 
                            reason: 'no_date',
                            availableFields: Object.keys(order).filter(k => k.includes('date') || k.includes('_at'))
                        });
                        continue;
                    }

                    try {
                        const orderDate = new Date(dateToCheck.replace(' ', 'T'));
                        if (isNaN(orderDate.getTime())) {
                            counts[COUNTER_KEYS.READY]++;
                            readyOrders.push({ 
                                id: order.order_id || order.id, 
                                reason: 'invalid_date',
                                date: dateToCheck 
                            });
                            continue;
                        }
                        
                        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
                        const ageInDays = Math.floor((Date.now() - orderDate.getTime()) / (24 * 60 * 60 * 1000));
                        
                        if (orderDate < twoWeeksAgo) {
                            counts[COUNTER_KEYS.OVERDUE]++;
                            overdueOrders.push({
                                id: order.order_id || order.id,
                                date: dateToCheck,
                                age: ageInDays
                            });
                        } else {
                            counts[COUNTER_KEYS.READY]++;
                            readyOrders.push({
                                id: order.order_id || order.id,
                                date: dateToCheck,
                                age: ageInDays
                            });
                        }
                    } catch (error) {
                        counts[COUNTER_KEYS.READY]++;
                        readyOrders.push({ 
                            id: order.order_id || order.id, 
                            reason: 'date_error',
                            error: error.message,
                            date: dateToCheck 
                        });
                    }
                } else if (status in counts) {
                    counts[status]++;
                } else {
                    this.log(LogLevel.WARNING, '⚠️ Unhandled status', {
                        id: order.order_id || order.id,
                        status,
                        availableStatuses: Object.keys(ORDER_STATUS_NAMES)
                    });
                }
            }

            const processingTime = Date.now() - startTime;

            this.log(LogLevel.INFO, '📊 Processing completed', {
                counts,
                total: Object.values(counts).reduce((a, b) => a + b, 0),
                statusBreakdown,
                readyVsOverdue: {
                    ready: counts[COUNTER_KEYS.READY],
                    overdue: counts[COUNTER_KEYS.OVERDUE],
                    total: statusBreakdown['5'] || 0
                },
                ordersByStatusCount: Object.fromEntries(Array.from(ordersByStatus.entries()).map(([status, orders]) => [status, orders.length])),
                readyOrders: readyOrders.length > 10 ? `${readyOrders.length} orders` : readyOrders,
                overdueOrders: overdueOrders.length > 10 ? `${overdueOrders.length} orders` : overdueOrders,
                processedOrdersCount: processedOrders.length,
                processingTime,
                averageTimePerOrder: processingTime / orders.length
            });

            // Verify processed data integrity
            const processedOrderIds = new Set(processedOrders.map(o => o.id));
            const originalOrderIds = new Set(orders.map(o => o.order_id || o.id));
            
            this.log(LogLevel.DEBUG, '🔍 Data integrity check', {
                originalOrders: orders.length,
                processedOrders: processedOrders.length,
                uniqueOriginalOrders: originalOrderIds.size,
                uniqueProcessedOrders: processedOrderIds.size,
                allOrdersProcessed: processedOrders.length === orders.length,
                integrityMatch: processedOrderIds.size === originalOrderIds.size
            });

            return {
                orders: processedOrders,
                counts,
                timestamp: Date.now(),
                storeId: store?.id || 'ALL',
                metadata: {
                    total: orders.length,
                    processedAt: Date.now(),
                    initialFetch: !this.#hasInitialData,
                    statusBreakdown,
                    readyCount: readyOrders.length,
                    overdueCount: overdueOrders.length,
                    processingTime,
                    uniqueOrders: processedOrderIds.size
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
                    total: Number(data.metadata?.total) || 0,
                    processedAt: Number(data.metadata?.processedAt) || Date.now(),
                    forceRefresh: Boolean(data.metadata?.forceRefresh),
                    originalFormat: data.metadata?.originalFormat || {},
                    initialFetch: Boolean(data.metadata?.initialFetch),
                    statusBreakdown: data.metadata?.statusBreakdown || {},
                    readyCount: Number(data.metadata?.readyCount) || 0,
                    overdueCount: Number(data.metadata?.overdueCount) || 0,
                    processingTime: Number(data.metadata?.processingTime) || 0,
                    uniqueOrders: Number(data.metadata?.uniqueOrders) || 0
                }
            };

            // Log data before validation
            this.log(LogLevel.DEBUG, '🔍 Cache data before validation', {
                hasRequiredFields: {
                    counts: !!cacheData.counts,
                    timestamp: !!cacheData.timestamp,
                    storeId: !!cacheData.storeId,
                    metadata: !!cacheData.metadata
                },
                dataTypes: {
                    counts: typeof cacheData.counts,
                    timestamp: typeof cacheData.timestamp,
                    storeId: typeof cacheData.storeId,
                    metadata: typeof cacheData.metadata
                }
            });

            try {
                this.#validateCacheData(cacheData);
            } catch (error) {
                this.log(LogLevel.ERROR, '❌ Cache validation failed', {
                    error: error.message,
                    cacheData: JSON.stringify(cacheData, null, 2)
                });
                throw error;
            }

            // Atomic update of both cache and timestamp
            await Promise.all([
                this.#storage.save(key, cacheData),
                this.#storage.save(CACHE_KEYS.LAST_UPDATE, Date.now())
            ]);

            this.log(LogLevel.SUCCESS, '✅ Cache updated successfully', {
                key,
                counts: cacheData.counts,
                total: cacheData.metadata.total,
                timestamp: new Date(cacheData.timestamp).toISOString()
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
            if (value === undefined || value === null) return false;
            if (expectedType === 'number') return typeof Number(value) === 'number' && !isNaN(Number(value));
            if (expectedType === 'string') return typeof String(value) === 'string';
            if (expectedType === 'boolean') return typeof Boolean(value) === 'boolean';
            if (expectedType === 'object') return typeof value === 'object' && !Array.isArray(value);
            if (expectedType === 'array') return Array.isArray(value);
            return false;
        };

        const validateObject = (obj, schema) => {
            if (!obj || typeof obj !== 'object') {
                throw new Error(`Invalid object: ${JSON.stringify(obj)}`);
            }

            for (const [key, expectedType] of Object.entries(schema)) {
                if (typeof expectedType === 'object') {
                    if (!obj[key] || typeof obj[key] !== 'object') {
                        this.log(LogLevel.ERROR, `❌ Invalid nested object for ${key}`, {
                            value: obj[key],
                            expectedType: 'object'
                        });
                        throw new Error(`Invalid type for ${key}: expected object`);
                    }
                    validateObject(obj[key], expectedType);
                } else if (!validateType(obj[key], expectedType)) {
                    this.log(LogLevel.ERROR, `❌ Validation failed for ${key}`, {
                        value: obj[key],
                        expectedType,
                        actualType: Array.isArray(obj[key]) ? 'array' : typeof obj[key]
                    });
                    throw new Error(`Invalid type for ${key}: expected ${expectedType}, got ${Array.isArray(obj[key]) ? 'array' : typeof obj[key]}`);
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
            id: order.order_id || order.id,
            status_id: order.status_id,
            status_name: ORDER_STATUS_NAMES[order.status_id] || 'Unknown',
            customer: {
                name: order.customer_name,
                email: order.customer_email,
                phone: order.customer_phone
            },
            delivery: {
                id: order.delivery_id,
                name: order.delivery_name,
                address: order.delivery_address
            },
            items: (order.items || []).map(item => ({
                id: item.id || item.product_id,
                name: item.product_name,
                quantity: Number(item.quantity) || 0,
                price: Number(item.price) || 0,
                total: Number(item.total) || 0
            })),
            dates: {
                created: order.created_at,
                modified: order.modified_at,
                ready: order.ready_date,
                status_change: order.status_change_date
            },
            total_amount: Number(order.total_amount) || 0,
            currency: order.currency || 'PLN',
            notes: order.notes || '',
            lastUpdate: Date.now()
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
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing order service...');
            
            // Get dependencies
            const storage = await this.getDependency('storage');
            const api = await this.getDependency('api');
            
            // Load credentials
            await this.#loadCredentials();
            
            this.log(LogLevel.SUCCESS, '✅ Order service initialized');
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
        if (!credentials?.client_id || !credentials?.client_secret) {
            throw new Error('Invalid credentials format');
        }
        this.#credentials = credentials;
    }

    async #loadCredentials() {
        try {
            const response = await fetch(chrome.runtime.getURL('config/credentials.json'));
            if (!response.ok) {
                throw new Error(`Failed to load credentials: ${response.statusText}`);
            }
            const credentials = await response.json();
            if (!credentials?.client_id || !credentials?.client_secret) {
                throw new Error('Invalid credentials format');
            }
            this.#credentials = credentials;
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'loadCredentials'
            });
            throw error;
        }
    }

    getCredentials() {
        return this.#credentials;
    }
}

// Export both class and instance
export { OrderService };

// Factory function with setRegistry method
export const createOrderService = Object.assign(
    (registry) => {
        if (!OrderService._registry) {
            OrderService.setRegistry(registry);
        }
        return new OrderService(registry);
    },
    { setRegistry: (registry) => OrderService.setRegistry(registry) }
);