import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';

const MESSAGE_CONFIG = {
    MAX_QUEUE_SIZE: 1000,
    MAX_LISTENERS: 100,
    PROCESS_INTERVAL: 100,
    BATCH_SIZE: 50,
    RESPONSE_TIMEOUT: 30000, // 30 seconds
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
};

/**
 * Manages message passing between components
 * @extends BaseManager
 */
class MessageManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;

    /** @private */
    #settings;

    /** @private */
    #listeners = new Map();
    
    /** @private */
    #messageQueue = [];
    
    /** @private */
    #pendingResponses = new Map();
    
    /** @private */
    #queueProcessInterval = null;
    
    /** @private */
    #processing = false;

    /** @private */
    #handleIncomingMessage = async (message, sender, sendResponse) => {
        try {
            const listeners = this.#listeners.get(message.type) || [];
            const results = await Promise.all(
                listeners.map(listener => listener(message.data, { sender, message }))
            );
            
            // If message requires response, send back the last result
            if (message.requiresResponse) {
                sendResponse(results[results.length - 1]);
            }
        } catch (error) {
            this.handleError(error, ErrorType.MESSAGE, ErrorSeverity.MEDIUM, {
                operation: 'handleIncomingMessage',
                messageType: message.type
            });
            if (message.requiresResponse) {
                sendResponse({ error: error.message });
            }
        }
    };

    /** @private */
    #setupEventListeners = () => {
        // Set up message listeners
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.#handleIncomingMessage(message, sender, sendResponse);
            return true; // Keep the message channel open for async response
        });
        
        // Start queue processor
        this.#startQueueProcessor();
    };

    constructor(registry) {
        if (MessageManager.#instance) {
            return MessageManager.#instance;
        }
        super(registry, 'MessageManager');
        MessageManager.#instance = this;
        MessageManager._registry = registry;
    }

    /**
     * Get singleton instance
     * @returns {MessageManager}
     */
    static getInstance() {
        if (!MessageManager.#instance && MessageManager._registry) {
            MessageManager.#instance = new MessageManager(MessageManager._registry);
        }
        return MessageManager.#instance;
    }

    static setRegistry(registry) {
        MessageManager._registry = registry;
    }

    /**
     * Initialize message manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing message manager...');
            
            // Load message settings
            const storage = await this.getDependency('storage');
            const settings = await storage.get(MESSAGE_CONFIG.STORAGE_KEY) || {};
            this.#settings = { ...MESSAGE_CONFIG.DEFAULT_SETTINGS, ...settings };
            
            // Set up event listeners
            this.#setupEventListeners();
            
            this.log(LogLevel.SUCCESS, '✅ Message manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Send a message with optional response
     * @param {string} type Message type
     * @param {*} data Message data
     * @param {Object} [options] Message options
     * @returns {Promise<*>} Response data if awaiting response
     */
    async send(type, data = null, options = {}) {
        try {
            const { 
                awaitResponse = false,
                timeout = MESSAGE_CONFIG.RESPONSE_TIMEOUT,
                retries = MESSAGE_CONFIG.MAX_RETRIES
            } = options;

            const message = {
                id: crypto.randomUUID(),
                type,
                data,
                timestamp: Date.now(),
                source: this.name,
                requiresResponse: awaitResponse
            };

            if (awaitResponse) {
                return this.#sendWithResponse(message, timeout, retries);
            }

            await this.#queueMessage(message);
            return null;
        } catch (error) {
            this.handleError(error, ErrorType.MESSAGE, ErrorSeverity.MEDIUM, {
                operation: 'send',
                type
            });
            throw error;
        }
    }

    /**
     * Send a message and wait for response
     * @private
     */
    async #sendWithResponse(message, timeout, retries) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.#pendingResponses.delete(message.id);
                reject(new Error(`Message response timeout: ${message.type}`));
            }, timeout);

            this.#pendingResponses.set(message.id, {
                resolve,
                reject,
                timeout: timeoutId,
                retries,
                message
            });

            this.#queueMessage(message).catch(error => {
                clearTimeout(timeoutId);
                this.#pendingResponses.delete(message.id);
                reject(error);
            });
        });
    }

    /**
     * Queue a message for processing
     * @private
     */
    async #queueMessage(message) {
        if (this.#messageQueue.length >= MESSAGE_CONFIG.MAX_QUEUE_SIZE) {
            throw new Error('Message queue full');
        }

        this.#messageQueue.push(message);
        
        this.log(LogLevel.DEBUG, `📥 Queued message: ${message.type}`, {
            id: message.id,
            queueSize: this.#messageQueue.length
        });

        await managers.eventManager.emit('message:queued', {
            type: message.type,
            id: message.id
        });
    }

    /**
     * Start queue processor
     * @private
     */
    #startQueueProcessor() {
        if (this.#queueProcessInterval) {
            clearInterval(this.#queueProcessInterval);
        }

        this.#queueProcessInterval = setInterval(
            () => this.#processMessageQueue(),
            MESSAGE_CONFIG.PROCESS_INTERVAL
        );

        this.log(LogLevel.DEBUG, '🔄 Message queue processor started');
    }

    /**
     * Process message queue
     * @private
     */
    async #processMessageQueue() {
        if (this.#processing || this.#messageQueue.length === 0) return;

        this.#processing = true;
        
        try {
            const batch = this.#messageQueue.splice(0, MESSAGE_CONFIG.BATCH_SIZE);
            
            for (const message of batch) {
                await this.#processMessage(message);
            }

            if (this.#messageQueue.length > 0) {
                this.log(LogLevel.DEBUG, `📊 Processed ${batch.length} messages, ${this.#messageQueue.length} remaining`);
            }
        } catch (error) {
            this.handleError(error, ErrorType.MESSAGE_QUEUE, ErrorSeverity.MEDIUM);
        } finally {
            this.#processing = false;
        }
    }

    /**
     * Process a single message
     * @private
     */
    async #processMessage(message) {
        const listeners = this.#listeners.get(message.type) || [];
        
        if (listeners.length === 0) {
            this.log(LogLevel.WARN, `⚠️ No listeners for message type: ${message.type}`);
            return;
        }

        try {
            const results = await Promise.all(
                listeners.map(listener => 
                    this.executeWithRetry(
                        () => listener(message.data, message),
                        {
                            maxAttempts: MESSAGE_CONFIG.MAX_RETRIES,
                            retryDelay: MESSAGE_CONFIG.RETRY_DELAY,
                            context: `message listener for ${message.type}`
                        }
                    )
                )
            );

            // Handle response if needed
            if (message.requiresResponse) {
                const pending = this.#pendingResponses.get(message.id);
                if (pending) {
                    clearTimeout(pending.timeout);
                    this.#pendingResponses.delete(message.id);
                    pending.resolve(results[0]); // Use first listener's response
                }
            }

            await managers.eventManager.emit('message:processed', {
                type: message.type,
                id: message.id
            });
        } catch (error) {
            this.handleError(error, ErrorType.MESSAGE_PROCESSING, ErrorSeverity.MEDIUM, {
                type: message.type,
                id: message.id
            });

            // Handle failed response
            if (message.requiresResponse) {
                const pending = this.#pendingResponses.get(message.id);
                if (pending) {
                    if (pending.retries > 0) {
                        // Retry message
                        this.#messageQueue.unshift({
                            ...pending.message,
                            retries: pending.retries - 1
                        });
                    } else {
                        clearTimeout(pending.timeout);
                        this.#pendingResponses.delete(message.id);
                        pending.reject(error);
                    }
                }
            }
        }
    }

    /**
     * Add message listener
     * @param {string} type Message type
     * @param {Function} listener Listener function
     */
    on(type, listener) {
        if (typeof listener !== 'function') {
            throw new Error('Listener must be a function');
        }

        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, new Set());
        }

        const listeners = this.#listeners.get(type);

        if (listeners.size >= MESSAGE_CONFIG.MAX_LISTENERS) {
            throw new Error(`Max listeners (${MESSAGE_CONFIG.MAX_LISTENERS}) exceeded for message type: ${type}`);
        }

        listeners.add(listener);
        
        this.log(LogLevel.DEBUG, `👂 Added listener for ${type}`);
        return true;
    }

    /**
     * Remove message listener
     * @param {string} type Message type
     * @param {Function} listener Listener function
     */
    off(type, listener) {
        const listeners = this.#listeners.get(type);
        if (!listeners) return false;

        const removed = listeners.delete(listener);
        
        if (removed) {
            this.log(LogLevel.DEBUG, `🗑️ Removed listener for ${type}`);
        }
        
        if (listeners.size === 0) {
            this.#listeners.delete(type);
        }
        
        return removed;
    }

    /**
     * Get message manager stats
     */
    getStats() {
        return {
            queueSize: this.#messageQueue.length,
            pendingResponses: this.#pendingResponses.size,
            listenerCount: Array.from(this.#listeners.entries()).reduce(
                (acc, [type, listeners]) => ({
                    ...acc,
                    [type]: listeners.size
                }),
                {}
            ),
            isProcessing: this.#processing
        };
    }

    /**
     * Dispose message manager
     */
    async dispose() {
        if (this.#queueProcessInterval) {
            clearInterval(this.#queueProcessInterval);
            this.#queueProcessInterval = null;
        }

        // Clear pending responses
        for (const { timeout, reject } of this.#pendingResponses.values()) {
            clearTimeout(timeout);
            reject(new Error('Message manager disposed'));
        }

        this.#messageQueue = [];
        this.#listeners.clear();
        this.#pendingResponses.clear();
        this.#processing = false;

        await super.dispose();
    }
}

// Export both class and instance
export { MessageManager };
export const messageManager = MessageManager.getInstance(); 
