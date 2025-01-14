import { API } from './api.js';
import { ErrorType, ErrorSeverity } from '../core/ErrorTypes.js';

export class OrderService extends API {
    constructor(credentials) {
        super();
        this.setBaseUrl('https://darwina.pl');
        
        // Debug log credentials (safely)
        console.log('[DEBUG] 🔑 Credentials provided:', {
            hasToken: !!credentials?.token,
            tokenLength: credentials?.token?.length
        });
        
        if (!credentials?.token) {
            console.error('[ERROR] ❌ No token provided in credentials');
            throw new Error('API token is required');
        }

        this.setHeader('Authorization', `Bearer ${credentials.token}`);
        console.log('[DEBUG] 🔒 Authorization header set successfully');
    }

    async fetchOrders(params = {}, signal) {
        try {
            // Build query parameters
            const queryParams = new URLSearchParams();
            
            // Debug the incoming params
            console.log('[DEBUG] 📝 Incoming params:', params);
            
            // Add default parameters
            queryParams.append('limit', params.limit || '50');
            if (params.page) queryParams.append('page', params.page);
            
            // Handle status_id (can be array or single value)
            if (params.status_id) {
                // Convert array to comma-separated string
                const statusValue = Array.isArray(params.status_id) 
                    ? params.status_id.join(',')
                    : params.status_id.toString();
                queryParams.append('status_id', statusValue);
                console.log('[DEBUG] 🔍 Adding status filter:', statusValue);
            }
            
            // Handle delivery_id carefully
            if (params.delivery_id && params.delivery_id !== 'ALL') {
                queryParams.append('delivery_id', params.delivery_id.toString());
                console.log('[DEBUG] 🏪 Adding delivery filter:', params.delivery_id);
            }
            
            if (params.modified_from) queryParams.append('modified_from', params.modified_from);
            
            // Build final URL
            const url = `/api/orders?${queryParams.toString()}`;
            
            // Log request details
            console.log('[DEBUG] 🔍 Request details:', {
                url,
                headers: {
                    accept: 'application/json',
                    authorization: 'Bearer [REDACTED]',
                    contentType: 'application/json'
                },
                params: Object.fromEntries(queryParams.entries())
            });
            
            const response = await this.get(url, null, { signal });
            
            if (!response || !response.data) {
                console.error('[ERROR] ❌ Invalid API response:', response);
                throw new Error('Invalid API response structure');
            }

            if (!Array.isArray(response.data)) {
                console.error('[ERROR] ❌ API response data is not an array:', response.data);
                throw new Error('Invalid API response data format');
            }

            console.log('[DEBUG] ✅ Response received:', {
                ordersCount: response.data.length,
                metadata: response.__metadata
            });

            return {
                success: true,
                orders: response.data,
                metadata: response.__metadata || {},
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('[ERROR] ❌ API request failed:', error);
            throw new Error(`Failed to fetch orders: ${error.message}`);
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