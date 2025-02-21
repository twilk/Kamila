import { BaseManager } from './BaseManager.js';
import { LogLevel } from './LogLevel.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { API_CONFIG } from '../../config/api.js';

// Development mode detection
const isDevelopment = () => {
    try {
        return !chrome.runtime.getManifest().update_url;
    } catch (e) {
        return false;
    }
};

/**
 * Manages API connections and requests
 * @extends BaseManager
 */
class ConnectionManager extends BaseManager {
    /** @private */
    static #instance = null;
    /** @private */
    static #registry = null;
    
    /** @private */
    #connectionStatus = false;
    
    /** @private */
    #isOnline = navigator.onLine;
    
    /** @private */
    #checkInterval = null;
    
    /** @private */
    #retryCount = 0;
    
    /** @private */
    #retryTimeout = null;
    
    /** @private */
    #headers = {
        'Content-Type': 'application/json'
    };

    // Private method declarations
    // #startConnectionCheck = undefined;
    // #checkConnection = undefined;
    // #startMonitoring = undefined;
    // #handleOnline = undefined;
    // #handleOffline = und efined;

    constructor(registry) {
        if (ConnectionManager.#instance) {
            return ConnectionManager.#instance;
        }
        super(registry, 'ConnectionManager');
        ConnectionManager.#instance = this;
        ConnectionManager.#registry = registry;
    }

    /**
     * Get singleton instance
     * @returns {ConnectionManager}
     */
    static getInstance() {
        if (!ConnectionManager.#instance && ConnectionManager.#registry) {
            ConnectionManager.#instance = new ConnectionManager(ConnectionManager.#registry);
        }
        return ConnectionManager.#instance;
    }

    static setRegistry(registry) {
        ConnectionManager.#registry = registry;
    }

    /**
     * Initialize connection manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing connection manager...');
            
            // Start connection monitoring
            this.#startMonitoring();
            
            // Set up event listeners
            window.addEventListener('online', () => this.#handleOnline());
            window.addEventListener('offline', () => this.#handleOffline());
            
            this.log(LogLevel.SUCCESS, '✅ Connection manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Start connection check interval
     * @private
     */
    #startConnectionCheck = () => {
        if (this.#checkInterval) {
            clearInterval(this.#checkInterval);
        }

        // Check connection every 30 seconds
        this.#checkInterval = setInterval(() => {
            // Skip checks in development mode
            if (isDevelopment()) return;

            this.#checkConnection().catch(error => {
                this.handleError(error, ErrorType.NETWORK, ErrorSeverity.MEDIUM, {
                    method: '_startConnectionCheck'
                });
            });
        }, 30000);
    };

    /**
     * Check connection status using access token endpoint
     * @private
     */
    #checkConnection = async () => {
        try {
            // In development mode, always return success
            if (isDevelopment()) {
                this.#connectionStatus = true;
                return;
            }

            const response = await fetch(`${API_CONFIG.DARWINA.BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.AUTH}`, {
                method: 'HEAD',
                headers: this.#headers
            });

            const wasConnected = this.#connectionStatus;
            this.#connectionStatus = response.ok;

            const eventManager = await this.getDependency('event');
            if (!wasConnected && response.ok) {
                this.log(LogLevel.SUCCESS, '🔄 Connection restored');
                eventManager.emit('connection-restored');
            } else if (wasConnected && !response.ok) {
                this.log(LogLevel.ERROR, '❌ Connection lost');
                eventManager.emit('connection-lost');
            }
        } catch (error) {
            // In development mode, ignore connection errors
            if (isDevelopment()) {
                this.#connectionStatus = true;
                return;
            }

            this.#connectionStatus = false;
            this.handleError(error, ErrorType.NETWORK, ErrorSeverity.MEDIUM, {
                method: '_checkConnection'
            });
            const eventManager = await this.getDependency('event');
            eventManager.emit('connection-error', error);
        }
    };

    /**
     * Get current connection status
     * @returns {boolean}
     */
    isConnected() {
        // In development mode, always return true
        if (isDevelopment()) {
            return true;
        }
        return this.#connectionStatus;
    }

    /**
     * Get headers
     * @returns {Object}
     */
    getHeaders() {
        return { ...this.#headers };
    }

    /**
     * Clean up resources
     */
    async dispose() {
        if (this.#checkInterval) {
            clearInterval(this.#checkInterval);
            this.#checkInterval = null;
        }

        if (this.#retryTimeout) {
            clearTimeout(this.#retryTimeout);
            this.#retryTimeout = null;
        }

        this.#connectionStatus = false;
        await super.dispose();
    }

    /**
     * Start connection monitoring
     * @private
     */
    #startMonitoring = () => {
        if (this.#checkInterval) {
            clearInterval(this.#checkInterval);
        }
        this.#checkInterval = setInterval(() => this.#checkConnection(), API_CONFIG.connectionCheckInterval);
    };
    
    /**
     * Handle online event
     * @private
     */
    #handleOnline = () => {
        this.#isOnline = true;
        this.emit('connection:online');
    };
    
    /**
     * Handle offline event
     * @private
     */
    #handleOffline = () => {
        this.#isOnline = false;
        this.emit('connection:offline');
    };
}

// Export both class and instance
export { ConnectionManager };
export const connectionManager = ConnectionManager.getInstance(); 