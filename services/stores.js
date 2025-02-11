import { DELIVERY_METHODS, DELIVERY_IDS } from '../config/delivery.js';

export const stores = [
    { id: 'ALL', name: 'Wszystkie sklepy', deliveryId: null, drwn: null },
    { id: 'EKO', name: 'EKO', address: 'EkoPark Mokotów - Chodkiewicza 8', deliveryId: 61, drwn: 'EKO - Chodkiewicza 8' },
    { id: 'EVT', name: 'EVT', address: 'Event', deliveryId: 62, drwn: 'EVT - Event' },
    { id: 'FIL', name: 'FIL', address: 'Gocław - Fieldorfa 10', deliveryId: 62, drwn: 'FIL - Fieldorfa 10' },
    { id: 'FRA', name: 'FRA', address: 'Francuska - Zwycięzców 23', deliveryId: 63, drwn: 'FRA - Zwyciezców 23' },
    { id: 'GU', name: 'GU', address: 'Galeria Ursynów - Al. KEN 36', deliveryId: 60, drwn: 'GU - Aleja KEN 36' },
    { id: 'HOK', name: 'HOK', address: 'Ursus Szamoty - Herbu Oksza 6', deliveryId: 64, drwn: 'HOK - Herbu Oksza 6' },
    { id: 'HRU', name: 'HRU', address: 'Przy Muzeum Powstania - Hrubieszowska 2', deliveryId: 65, drwn: 'HRU - Hrubieszowska 2' },
    { id: 'IKR', name: 'IKR', address: 'Idzikowskiego - Ikara 20', deliveryId: 66, drwn: 'IKR - Ikara 20' },
    { id: 'KBT', name: 'KBT', address: 'Kabaty - Wąwozowa 6', deliveryId: 59, drwn: 'KBT - Wąwozowa 6_4B' },
    { id: 'LND', name: 'LND', address: 'C.H. Land - M. Służew - Wałbrzyska 11 lok 144b', deliveryId: 67, drwn: 'LND - Wałbrzyska 11' },
    { id: 'LUC', name: 'LUC', address: 'Przy Hiltonie - Łucka 20', deliveryId: 68, drwn: 'ŁUK - Łucka 20' },
    { id: 'MAG', name: 'MAG', address: 'MAG', deliveryId: 89, drwn: null },
    { id: 'MCZ', name: 'MCZ', address: 'Kabaty przy Bazarku - Wąwozowa 31', deliveryId: 58, drwn: 'MCZ - Wąwozowa 31' },
    { id: 'MOT', name: 'MOT', address: 'Praga Południe - Motorowa 10', deliveryId: 69, drwn: 'MOT - Motorowa 10' },
    { id: 'NOW', name: 'NOW', address: 'Przy Promenadzie - Nowaka-Jeziorańskiego 9', deliveryId: 70, drwn: 'NOW - Nowaka-Jeziorańskiego 9' },
    { id: 'OBR', name: 'OBR', address: 'Służewiec - Obrzeżna 7a', deliveryId: 71, drwn: 'OBR - Obrzeżna 7A_U1' },
    { id: 'PAN', name: 'PAN', address: 'Rondo ONZ - Pańska 73', deliveryId: 73, drwn: 'PAN - Pańska 73' },
    { id: 'PLO', name: 'PLO', address: 'Metro Płocka - Skierniewicka 34', deliveryId: 74, drwn: 'PLO - Skierniewicka 34' },
    { id: 'POW', name: 'POW', address: 'Artystyczny Żoliborz - Powązkowska 42', deliveryId: 75, drwn: 'POW - Powązkowska 42' },
    { id: 'RAC', name: 'RAC', address: 'Woronicza - Racjonalizacji 7', deliveryId: 76, drwn: 'RAC - Racjonalizacji 7' },
    { id: 'RAY', name: 'RAY', address: 'Bemowo Chrzanów - Rayskiego 11', deliveryId: 77, drwn: 'RAY - Rayskiego 11' },
    { id: 'RKW', name: 'RKW', address: 'Puławska - Rakowiecka 1/3', deliveryId: 78, drwn: 'RKW - Rakowiecka 1/3' },
    { id: 'RP', name: 'RP', address: 'Aleja Rzeczypospolitej 12', deliveryId: 79, drwn: 'RP - Rzeczypospolitej 12' },
    { id: 'SIK', name: 'SIK', address: 'Stegny - Sikorskiego 9b', deliveryId: 80, drwn: 'SIK - Sikorskiego 9B' },
    { id: 'STO', name: 'STO', address: 'Stokłosy - Al. KEN 95', deliveryId: 81, drwn: 'STO - Aleja KEN 95' },
    { id: 'WDK', name: 'WDK', address: 'Centrum - Widok 19', deliveryId: 82, drwn: 'WDK - Widok 19' },
    { id: 'WIL', name: 'WIL', address: 'Miasteczko Wilanów - Aleja Rzeczypospolitej 12', deliveryId: 83, drwn: 'WIL - Aleja Wilanowska 103' },
    { id: 'ŻEL', name: 'ŻEL', address: 'Wola - Żelazna 67', deliveryId: 84, drwn: 'ZEL - Zelazna 67' }
];

// Funkcja sprawdzająca czy wybrana metoda to odbiór osobisty
export const isPickupDelivery = (deliveryMethod) => {
    return deliveryMethod === DELIVERY_METHODS.PICKUP;
};

/**
 * Process order with store-specific logic
 * @param {Object} order - Order to process
 * @returns {Object} Processed order
 * @throws {Error} If store validation fails
 */
export const processOrder = (order) => {
    if (!order) {
        throw new Error('Order is required');
    }

    // Validate store
    const store = validateStore(order.store_id);

    // Handle ALL stores case
    if (store.id === 'ALL') {
        throw new Error('Cannot process order with ALL stores selection');
    }

    // Process based on delivery method
    if (isPickupDelivery(order.delivery_method)) {
        // For pickup delivery, set pickup location in comment
        order.client_comment = order.client_comment || '';
        if (!order.client_comment.includes(store.address)) {
            order.client_comment = order.client_comment
                ? `${order.client_comment}\nPunkt odbioru: ${store.address}`
                : `Punkt odbioru: ${store.address}`;
        }
        order.delivery_id = DELIVERY_IDS.PICKUP;
    } else {
        // For other delivery methods, use store's delivery ID
        if (!store.deliveryId) {
            throw new Error(`Store ${store.id} does not have a delivery ID configured`);
        }
        order.delivery_id = store.deliveryId;
        
        // Clear pickup-related comments if present
        if (order.client_comment && order.client_comment.includes('Punkt odbioru:')) {
            order.client_comment = order.client_comment
                .split('\n')
                .filter(line => !line.includes('Punkt odbioru:'))
                .join('\n')
                .trim();
        }
    }
    
    return order;
};

// Funkcja filtrująca sklepy dla wybranej metody dostawy
export const filterStoresByDeliveryMethod = (deliveryMethod, includeAll = true) => {
    // Start with all stores
    let filteredStores = [...stores];

    // Handle ALL stores option
    if (!includeAll) {
        filteredStores = filteredStores.filter(store => store.id !== 'ALL');
    }

    // If no delivery method specified, return current list
    if (!deliveryMethod) {
        return filteredStores;
    }

    // Filter based on delivery method
    if (isPickupDelivery(deliveryMethod)) {
        // For pickup delivery, include stores with address
        return filteredStores.filter(store => 
            store.id === 'ALL' || // Keep ALL if includeAll is true
            (store.address && (!store.deliveryId || store.deliveryId === DELIVERY_IDS.PICKUP))
        );
    } else {
        // For other delivery methods, include stores with valid delivery ID
        return filteredStores.filter(store =>
            store.id === 'ALL' || // Keep ALL if includeAll is true
            (store.deliveryId && store.deliveryId !== DELIVERY_IDS.PICKUP)
        );
    }
};

/**
 * Validate order delivery settings
 * @param {Object} order - Order to validate
 * @returns {Object} Validation result with status and message
 */
export const validateOrderDelivery = (order) => {
    try {
        if (!order) {
            return {
                isValid: false,
                message: 'Order is required'
            };
        }

        // Validate store
        const store = validateStore(order.store_id);

        // Cannot use ALL stores for orders
        if (store.id === 'ALL') {
            return {
                isValid: false,
                message: 'Cannot process order with ALL stores selection'
            };
        }

        // Validate based on delivery method
        if (isPickupDelivery(order.delivery_method)) {
            // For pickup delivery, require comment with pickup location
            const hasPickupLocation = order.client_comment && 
                order.client_comment.includes(`Punkt odbioru: ${store.address}`);
            
            if (!hasPickupLocation) {
                return {
                    isValid: false,
                    message: 'Missing pickup location in order comment'
                };
            }

            if (order.delivery_id !== DELIVERY_IDS.PICKUP) {
                return {
                    isValid: false,
                    message: 'Invalid delivery ID for pickup order'
                };
            }
        } else {
            // For other delivery methods, validate delivery ID
            if (!store.deliveryId) {
                return {
                    isValid: false,
                    message: `Store ${store.id} does not have a delivery ID configured`
                };
            }

            if (order.delivery_id !== store.deliveryId) {
                return {
                    isValid: false,
                    message: `Invalid delivery ID: expected ${store.deliveryId}, got ${order.delivery_id}`
                };
            }
        }

        return {
            isValid: true,
            message: 'Order delivery settings are valid'
        };
    } catch (error) {
        return {
            isValid: false,
            message: error.message
        };
    }
};

/**
 * Validate store ID and return store object
 * @param {string} storeId - Store ID to validate
 * @returns {Store} Validated store object
 * @throws {Error} If store is invalid
 */
export const validateStore = (storeId) => {
    // Validate input
    if (!storeId || typeof storeId !== 'string') {
        throw new Error(`Invalid store ID: ${storeId} (${typeof storeId})`);
    }

    // Handle ALL stores case
    if (storeId === 'ALL') {
        return stores[0]; // First store is always ALL
    }

    // Find store in configuration
    const store = stores.find(s => s.id === storeId);
    if (!store) {
        throw new Error(`Store not found: ${storeId}`);
    }

    // Validate required fields
    if (!store.name) {
        throw new Error(`Store ${storeId} is missing required name field`);
    }

    if (!store.address && storeId !== 'ALL') {
        throw new Error(`Store ${storeId} is missing required address field`);
    }

    // Validate delivery ID if present
    if (store.deliveryId !== null && store.deliveryId !== undefined) {
        if (typeof store.deliveryId !== 'number' || store.deliveryId <= 0) {
            throw new Error(`Invalid delivery ID for store ${storeId}: ${store.deliveryId}`);
        }
    }

    return store;
};

/**
 * Get store data with error handling
 * @param {string} storeId - Store ID to get data for
 * @param {Object} [errorHandler] - Optional error handler
 * @returns {Promise<Object|null>} Store data or null if error
 */
export const getStoreData = async (storeId, errorHandler) => {
    try {
        // Validate store
        const store = validateStore(storeId);

        // Build store data object
        const storeData = {
            id: store.id,
            name: store.name,
            address: store.address || null,
            deliveryId: store.deliveryId || null,
            drwn: store.drwn || null,
            isAll: store.id === 'ALL',
            hasDelivery: !!store.deliveryId && store.deliveryId !== DELIVERY_IDS.PICKUP,
            hasPickup: !!store.address,
            timestamp: Date.now()
        };

        // Validate required fields
        if (!storeData.id || !storeData.name) {
            throw new Error(`Store ${storeId} is missing required fields`);
        }

        // Log store data in debug mode
        if (process.env.NODE_ENV === 'development') {
            console.debug('[DEBUG] 🏪 Store data:', storeData);
        }

        return storeData;
    } catch (error) {
        // Handle error with provided handler or default to console
        if (errorHandler) {
            errorHandler.handleError(error, ErrorType.DATA, ErrorSeverity.ERROR, {
                method: 'getStoreData',
                storeId,
                timestamp: Date.now()
            });
        } else {
            console.error('[ERROR] ❌ Failed to get store data:', {
                storeId,
                error: error.message,
                stack: error.stack
            });
        }
        return null;
    }
};

/**
 * Check if store is available for API operations
 * @param {string} storeId - Store ID to check
 * @param {Object} [options] - Optional settings
 * @param {boolean} [options.checkApi=true] - Whether to check API status
 * @param {number} [options.timeout=5000] - API check timeout in ms
 * @returns {Promise<Object>} Availability status with details
 */
export const isStoreAvailableForApi = async (storeId, options = {}) => {
    const {
        checkApi = true,
        timeout = 5000
    } = options;

    try {
        // Validate input
        if (!storeId || typeof storeId !== 'string') {
            return {
                available: false,
                message: `Invalid store ID: ${storeId} (${typeof storeId})`,
                details: { storeId, type: typeof storeId }
            };
        }

        // Get store data
        const store = await getStoreData(storeId);
        if (!store) {
            return {
                available: false,
                message: 'Store not found',
                details: { storeId }
            };
        }

        // Check if store has API configuration
        if (!store.drwn) {
            return {
                available: false,
                message: 'Store has no API configuration',
                details: {
                    storeId,
                    store: {
                        id: store.id,
                        name: store.name,
                        hasApi: false
                    }
                }
            };
        }

        // Check API status if required
        if (checkApi) {
            const apiStatus = await checkApiStatus(store.drwn, timeout);
            if (!apiStatus.available) {
                return {
                    available: false,
                    message: 'Store API is not available',
                    details: {
                        storeId,
                        apiStatus
                    }
                };
            }
        }

        return {
            available: true,
            message: 'Store is available for API operations',
            details: {
                storeId,
                store: {
                    id: store.id,
                    name: store.name,
                    hasApi: true,
                    apiStatus: checkApi ? 'active' : 'not_checked'
                }
            }
        };
    } catch (error) {
        return {
            available: false,
            message: error.message,
            details: {
                storeId,
                error: {
                    message: error.message,
                    stack: error.stack
                }
            }
        };
    }
};

/**
 * Check API status with timeout
 * @private
 * @param {Object} drwnConfig - API configuration
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Object>} API status
 */
async function checkApiStatus(drwnConfig, timeout) {
    try {
        // Validate configuration
        if (!drwnConfig?.url || !drwnConfig?.key) {
            return {
                available: false,
                message: 'Invalid API configuration',
                details: { hasUrl: !!drwnConfig?.url, hasKey: !!drwnConfig?.key }
            };
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            // Check API status
            const response = await fetch(`${drwnConfig.url}/status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${drwnConfig.key}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            return {
                available: response.ok,
                message: response.ok ? 'API is active' : `API returned status ${response.status}`,
                details: {
                    status: response.status,
                    statusText: response.statusText
                }
            };
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    } catch (error) {
        const isTimeout = error.name === 'AbortError';
        return {
            available: false,
            message: isTimeout ? 'API check timed out' : 'API check failed',
            details: {
                error: {
                    message: error.message,
                    type: error.name,
                    isTimeout
                }
            }
        };
    }
} 