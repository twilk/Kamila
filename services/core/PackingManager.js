import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity, LogLevel } from './EventType.js';
import { API_CONFIG, FTP_CONFIG } from '../../config/api.js';

/**
 * Manager for handling packing requests for shipping stores
 * @extends BaseManager
 */
class PackingManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;

    /** @private */
    #cache = new Map();
    #lastUpdate = null;
    #updateInterval = null;
    #credentials = null;

    constructor(registry) {
        if (PackingManager.#instance) {
            return PackingManager.#instance;
        }
        super(registry, 'PackingManager');
        PackingManager.#instance = this;
        PackingManager._registry = registry;
        
        // Add dependencies
        this.addDependency('event');
        this.addDependency('store');
        this.addDependency('order');
        this.addDependency('storage');
    }

    static getInstance() {
        if (!PackingManager.#instance && PackingManager._registry) {
            PackingManager.#instance = new PackingManager(PackingManager._registry);
        }
        return PackingManager.#instance;
    }

    static setRegistry(registry) {
        PackingManager._registry = registry;
    }

    /**
     * Initialize packing manager
     * @protected
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing packing manager...');
            
            // Get required dependencies
            const [eventManager, orderService, storageManager] = await Promise.all([
                this.getDependency('event'),
                this.getDependency('order'),
                this.getDependency('storage')
            ]);

            if (!eventManager?.isInitialized()) {
                throw new Error('EventManager must be initialized');
            }

            // Load FTP credentials
            await this.#loadFTPCredentials();

            // Setup auto-refresh
            this.#setupAutoRefresh();

            // Setup event listeners
            await this.#setupEventListeners();

            this.log(LogLevel.SUCCESS, '✅ Packing manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Get packing requests for shipping stores
     * @returns {Promise<Array>} List of packing requests
     */
    async getPackingRequests() {
        try {
            const orderService = await this.getDependency('order');
            const requests = [];

            for (const store of API_CONFIG.SHIPPING_STORES) {
                const url = new URL(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ORDERS}`);
                url.searchParams.set('store_id', store.id);
                url.searchParams.set('status', 'pending');
                url.searchParams.set('limit', '50');

                const orders = await orderService.fetchOrders(url);
                
                // Transform orders into packing requests
                const storeRequests = orders.map(order => ({
                    id: order.id,
                    store: {
                        id: store.id,
                        name: store.name,
                        deliveryId: store.deliveryId
                    },
                    products: order.items.map(item => ({
                        id: item.product_id,
                        name: item.name,
                        quantity: item.quantity,
                        ean: item.ean,
                        price: item.price,
                        category: item.category
                    })),
                    isShipping: order.shipping_method !== null,
                    packed: order.status === 'packed',
                    created_at: order.created_at
                }));

                requests.push(...storeRequests);
            }

            // Cache the results
            this.#cache.set('requests', requests);
            this.#lastUpdate = Date.now();

            return {
                success: true,
                data: requests
            };
        } catch (error) {
            this.handleError(error, ErrorType.API, ErrorSeverity.HIGH);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Confirm packing request
     * @param {Object} request Packing request to confirm
     */
    async confirmPacking(request) {
        try {
            // Generate exchange file
            const fileContent = this.#generateExchangeFile(request);
            
            // Upload to FTP
            const ftpResult = await this.#uploadToFTP(fileContent.filename, fileContent.content);
            
            if (!ftpResult.success) {
                throw new Error('Failed to upload exchange file to FTP');
            }

            // Update order status
            const orderService = await this.getDependency('order');
            const result = await orderService.updateOrderStatus(request.id, 'packed');

            if (!result.success) {
                throw new Error('Failed to update order status');
            }

            // Emit event
            const eventManager = await this.getDependency('event');
            await eventManager.emit('packing:confirmed', {
                request,
                timestamp: new Date().toISOString()
            });

            // Update cache
            const requests = this.#cache.get('requests') || [];
            const updatedRequests = requests.map(r => 
                r.id === request.id ? { ...r, packed: true } : r
            );
            this.#cache.set('requests', updatedRequests);

            return {
                success: true
            };
        } catch (error) {
            this.handleError(error, ErrorType.PACKING, ErrorSeverity.HIGH);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Load FTP credentials from storage
     * @private
     */
    async #loadFTPCredentials() {
        try {
            const storage = await this.getDependency('storage');
            const credentials = await storage.get('ftp_credentials');
            
            if (!credentials) {
                // Use default config if no credentials stored
                this.#credentials = FTP_CONFIG;
                return;
            }

            this.#credentials = credentials;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            throw error;
        }
    }

    /**
     * Setup auto-refresh for packing requests
     * @private
     */
    #setupAutoRefresh() {
        if (this.#updateInterval) {
            clearInterval(this.#updateInterval);
        }

        this.#updateInterval = setInterval(
            () => this.getPackingRequests(),
            API_CONFIG.REFRESH_INTERVAL
        );
    }

    /**
     * Setup event listeners
     * @private
     */
    async #setupEventListeners() {
        const eventManager = await this.getDependency('event');

        // Listen for manual refresh requests
        await eventManager.on('packing:refresh', () => this.getPackingRequests());

        // Listen for FTP config updates
        await eventManager.on('ftp:config_updated', async (config) => {
            const storage = await this.getDependency('storage');
            await storage.set('ftp_credentials', config);
            this.#credentials = config;
        });
    }

    /**
     * Generate exchange file content
     * @private
     */
    #generateExchangeFile(request) {
        const now = new Date();
        const formattedDate = now.toLocaleDateString('pl-PL');
        
        // Generate unique file name
        const filename = `RW_wydanie_${request.store.id}-${request.id}_1.txt`;
        
        // Generate content based on the template
        const content = `TypPolskichLiter:LA
TypDok:RW
NrDok:RW_${request.store.id}-${request.id}
Data:${formattedDate}
Magazyn:${request.store.name}
SposobPlatn:GOT
TerminPlatn:0
IndeksCentralny:NIE
NazwaWystawcy:Darwina.pl Retail Sp. z o.o
AdresWystawcy:W•wozowa 6/4B, 02-796 Warszawa
KodWystawcy:02-796
PocztaWystawcy:
MiastoWystawcy:Warszawa
UlicaWystawcy:W•wozowa 6/4B
NrDomuWystawcy:6
NrLokaluWystawcy:4B
NazwaUlicyWystawcy:W•wozowa
GminaWystawcy:Warszawa
PowiatWystawcy:Warszawa
WojewodztwoWystawcy:mazowieckie
KodKrajuWystawcy:PL
NIPWystawcy:9512387656
BankWystawcy:mBank
KontoWystawcy:50 1140 2004 0000 3102 7760 2647
TelefonWystawcy:+48 888 160 888
NrWystawcyWSieciSklepow:${request.store.deliveryId}
WystawcaToCentralaSieci:0
NrWystawcyObcyWSieciSklepow:
IloscLinii:${request.products.length}
${request.products.map(product => {
    const netValue = (product.quantity * product.price).toFixed(2);
    const grossValue = (product.quantity * product.price * 1.23).toFixed(2);
    return `Linia:Nazwa{${product.name}}Kod{${product.ean}}Vat{23}Jm{szt}Asortyment{${product.category || 'INNE'}}Sww{}PKWiU{}Ilosc{${product.quantity}}Cena{n${product.price}}Wartosc{n${netValue}}IleWOpak{1}CenaSp{b${grossValue}}TowId{${product.id}}`;
}).join('\n')}
Stawka:Vat{23}SumaNet{${request.products.reduce((sum, p) => sum + p.quantity * p.price, 0).toFixed(2)}}SumaVat{${(request.products.reduce((sum, p) => sum + p.quantity * p.price * 0.23, 0)).toFixed(2)}}
DoZaplaty:${(request.products.reduce((sum, p) => sum + p.quantity * p.price * 1.23, 0)).toFixed(2)}`;

        return { filename, content };
    }

    /**
     * Upload file to FTP
     * @private
     */
    async #uploadToFTP(filename, content) {
        try {
            const ftpClient = new (require('ftp'))();
            
            return new Promise((resolve, reject) => {
                ftpClient.on('ready', () => {
                    ftpClient.put(Buffer.from(content), filename, (err) => {
                        ftpClient.end();
                        if (err) {
                            reject(err);
                        } else {
                            resolve({ success: true });
                        }
                    });
                });

                ftpClient.on('error', (err) => {
                    ftpClient.end();
                    reject(err);
                });

                ftpClient.connect(this.#credentials);
            });
        } catch (error) {
            this.handleError(error, ErrorType.FTP, ErrorSeverity.HIGH);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Clean up resources
     * @protected
     */
    async _dispose() {
        if (this.#updateInterval) {
            clearInterval(this.#updateInterval);
            this.#updateInterval = null;
        }
        this.#cache.clear();
        await super._dispose();
    }

    /**
     * Get manager metrics
     * @returns {Object} Metrics object
     */
    getMetrics() {
        return {
            ...super.getMetrics(),
            packing: {
                requestCount: this.#cache.get('requests')?.length || 0,
                lastUpdate: this.#lastUpdate,
                cacheSize: this.#cache.size
            }
        };
    }
}

export { PackingManager };
export const packingManager = PackingManager.getInstance(); 