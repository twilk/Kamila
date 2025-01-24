/**
 * @deprecated This file is being migrated to TypeScript implementation in services/api/index.ts
 * Please refer to the migration guide in docs/api-migration.md
 * This file will be removed in version 4.0.0
 */

import { API } from './api.js';
import { ErrorType, ErrorSeverity } from '../core/ErrorTypes.js';
import { ErrorHandler } from '../core/ErrorHandler.js';

// API endpoints and configuration
const API_BASE_URL = 'https://darwina.pl';
const API_ENDPOINTS = {
    ORDERS: '/api/orders'
};

export class OrderService extends API {
    constructor(credentials) {
        super();
        this._errorHandler = ErrorHandler.getInstance();
        this.setBaseUrl(API_BASE_URL);
        
        try {
            // Validate credentials
            if (!credentials) {
                throw new Error('Credentials are required');
            }

            // Debug log credentials (safely)
            this.log(LogLevel.DEBUG, '🔑 Validating credentials', {
                hasToken: !!credentials?.token,
                tokenLength: credentials?.token?.length
            });
            
            if (!credentials?.token) {
                throw new Error('API token is required');
            }

            this.setHeader('Authorization', `Bearer ${credentials.token}`);
            this.log(LogLevel.SUCCESS, '✅ API service initialized successfully');
        } catch (error) {
            this._errorHandler.handle(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                context: 'OrderService initialization failed'
            });
            throw error;
        }
    }

    /**
     * Helper method to build API URLs with validation
     */
    buildApiUrl(endpoint, params = {}) {
        try {
            if (!endpoint) {
                throw new Error('Endpoint is required');
            }

            const queryParams = new URLSearchParams();
            
            // Add parameters with validation
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    if (Array.isArray(value)) {
                        queryParams.append(key, value.join(','));
                    } else if (value !== 'ALL') {
                        queryParams.append(key, value.toString());
                    }
                }
            });

            const url = `${this.baseUrl}${endpoint}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
            this.log(LogLevel.DEBUG, '🔗 Built API URL', { url });
            return url;
        } catch (error) {
            this._errorHandler.handle(error, ErrorType.API, ErrorSeverity.MEDIUM, {
                context: 'Failed to build API URL',
                endpoint,
                params
            });
            throw error;
        }
    }

    /**
     * Fetch orders with retry mechanism
     */
    async fetchOrders(params = {}, signal) {
        let attempts = 0;
        const maxRetries = 3;

        while (attempts < maxRetries) {
            try {
                const url = this.buildApiUrl(API_ENDPOINTS.ORDERS, params);
                const response = await this.request(url, { signal });

                if (!response || typeof response !== 'object') {
                    throw new Error('Invalid API response structure');
                }

                if (!Array.isArray(response.data)) {
                    throw new Error('Invalid API response data format');
                }

                this.log(LogLevel.SUCCESS, '✅ Orders fetched successfully', {
                    count: response.data.length
                });

                return response.data;
            } catch (error) {
                attempts++;
                this._errorHandler.handle(error, ErrorType.API, ErrorSeverity.HIGH, {
                    context: 'Failed to fetch orders',
                    attempt: attempts,
                    maxRetries
                });

                if (attempts >= maxRetries) {
                    throw new Error(`Failed to fetch orders after ${maxRetries} attempts: ${error.message}`);
                }

                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
            }
        }
    }

    async fetchAllOrders(storeConfig = null, signal) {
        try {
            let allOrders = [];
            let currentPage = 1;
            let hasMorePages = true;

            // Prepare base params with default status filter
            const baseParams = {
                page: 1,
                limit: 50,
                status_id: [1, 2, 3, 5]  // Always filter by these statuses
            };
            console.log(`[DEBUG] 🔍 Using default status filter:`, baseParams.status_id);

            // Handle store-specific filtering
            if (storeConfig) {
                if (storeConfig.id === 'ALL') {
                    console.log('[INFO] 📦 Fetching orders for all stores');
                } else if (storeConfig.deliveryId) {
                    baseParams.delivery_id = storeConfig.deliveryId;
                    console.log(`[INFO] 📦 Fetching orders for store ${storeConfig.id}:`, baseParams);
                } else {
                    console.warn(`[WARNING] ⚠️ Store ${storeConfig.id} has no delivery ID configured, fetching all orders`);
                }
            }

            while (hasMorePages) {
                baseParams.page = currentPage;
                console.log(`[DEBUG] 📑 Fetching page ${currentPage} with params:`, baseParams);
                const result = await this.fetchOrders(baseParams, signal);

                if (!result.success) {
                    throw new Error('Failed to fetch page ' + currentPage);
                }

                // Filter orders if needed
                let pageOrders = result.orders;
                if (storeConfig?.id !== 'ALL' && storeConfig?.deliveryId) {
                    pageOrders = pageOrders.filter(order => 
                        order.delivery_id?.toString() === storeConfig.deliveryId.toString() 
                        // || order.store_id?.toString() === storeConfig.id.toString()
                    );
                }

                allOrders = [...allOrders, ...pageOrders];
                
                // Check if we have more pages
                const totalPages = result.metadata.page_count || 1;
                hasMorePages = currentPage < totalPages;
                currentPage++;

                console.log(`[DEBUG] 📦 Fetched page ${currentPage-1}/${totalPages} (${pageOrders.length} orders)`);
            }

            // Process orders and count statuses
            const counts = this.calculateOrderCounts(allOrders);

            console.log(`[SUCCESS] ✅ Fetched total ${allOrders.length} orders with counts:`, counts);

            return {
                success: true,
                orders: allOrders,
                counts: counts,
                timestamp: Date.now(),
                storeId: storeConfig?.id || 'ALL'
            };
        } catch (error) {
            console.error(`[ERROR] ❌ Failed to fetch orders for store ${storeConfig?.id}:`, error);
            throw new Error(`Failed to fetch all orders: ${error.message}`);
        }
    }

    calculateOrderCounts(orders) {
        const counts = {
            '1': 0,  // SUBMITTED
            '2': 0,  // CONFIRMED
            '3': 0,  // ACCEPTED
            'READY': 0,
            'OVERDUE': 0
        };

        const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);

        orders.forEach(order => {
            const status = order.status_id?.toString();
            if (!status) return;

            // For READY status, check if it's overdue
            if (status === '5') {
                const readyDate = order.ready_date || order.status_change_date || order.modified_at;
                if (readyDate) {
                    const orderDate = new Date(readyDate.replace(' ', 'T'));
                    if (orderDate < twoWeeksAgo) {
                        counts['OVERDUE']++;
                    } else {
                        counts['READY']++;
                    }
                }
            } else if (['1', '2', '3'].includes(status)) {
                counts[status]++;
            }
        });

        return counts;
    }
} 