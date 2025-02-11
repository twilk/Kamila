import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { storageManager } from './StorageManager.js';

const MESSAGE_QUEUE_KEY = 'pending_messages';
const MAX_QUEUE_SIZE = 100;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

/**
 * Manages message communication between background and popup
 * @extends {BaseManager}
 */
export class MessageManager extends BaseManager {
    static #instance = null;
    #messageQueue = new Map();
    #retryAttempts = new Map();
    #ports = new Set();
    #isProcessingQueue = false;
    #messageListeners = new Map();

    constructor() {
        if (MessageManager.#instance) {
            return MessageManager.#instance;
        }
        super('MessageManager');
        MessageManager.#instance = this;
    }

    static getInstance() {
        if (!MessageManager.#instance) {
            MessageManager.#instance = new MessageManager();
        }
        return MessageManager.#instance;
    }

    /**
     * Add a message listener
     * @param {string} type - Message type to listen for
     * @param {Function} callback - Callback function to handle the message
     */
    addListener(type, callback) {
        if (!this.#messageListeners.has(type)) {
            this.#messageListeners.set(type, new Set());
        }
        this.#messageListeners.get(type).add(callback);
        this.log(LogLevel.DEBUG, `📌 Added listener for message type: ${type}`);
    }

    /**
     * Remove a message listener
     * @param {string} type - Message type to remove listener for
     * @param {Function} callback - Callback function to remove
     */
    removeListener(type, callback) {
        if (this.#messageListeners.has(type)) {
            this.#messageListeners.get(type).delete(callback);
            if (this.#messageListeners.get(type).size === 0) {
                this.#messageListeners.delete(type);
            }
            this.log(LogLevel.DEBUG, `🗑️ Removed listener for message type: ${type}`);
        }
    }

    /**
     * Handle incoming message
     * @param {Object} message - Message object
     * @private
     */
    #handleMessage(message) {
        const { type, payload } = message;
        if (this.#messageListeners.has(type)) {
            this.#messageListeners.get(type).forEach(callback => {
                try {
                    callback(message);
                } catch (error) {
                    this.log(LogLevel.ERROR, `❌ Error in message listener for type ${type}:`, error);
                    this.errorHandler?.handleError(error, ErrorType.MESSAGE_HANDLER, ErrorSeverity.MEDIUM);
                }
            });
        }
    }

    /**
     * Initialize message manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing message manager...');

            // Load pending messages from storage
            await this.#loadPendingMessages();

            // Setup message listeners
            this.#setupMessageListeners();

            // Setup port connection listener
            chrome.runtime.onConnect.addListener((port) => {
                if (port.name === 'popup') {
                    this.#ports.add(port);
                    this.log(LogLevel.DEBUG, '🔌 New popup connection established');

                    port.onMessage.addListener((message) => {
                        this.#handleMessage(message);
                    });

                    port.onDisconnect.addListener(() => {
                        this.#ports.delete(port);
                        this.log(LogLevel.DEBUG, '🔌 Popup connection closed');
                    });
                }
            });

            this.log(LogLevel.INFO, '✅ Message manager initialized');
            return true;
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Failed to initialize message manager:', error);
            this.errorHandler?.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Setup message listeners
     * @private
     */
    #setupMessageListeners() {
        // Add default message handlers here
        this.addListener('PING', () => {
            return { type: 'PONG', status: 'OK' };
        });

        this.addListener('STATE_SYNC_REQUEST', async (message) => {
            const state = await this.getCurrentState();
            return {
                type: 'STATE_SYNC_RESPONSE',
                syncId: message.syncId,
                state
            };
        });
    }

    /**
     * Get current application state
     * @returns {Promise<Object>}
     * @private
     */
    async getCurrentState() {
        return {
            timestamp: Date.now(),
            connected: this.#ports.size > 0,
            queueSize: this.#messageQueue.size,
            retryAttempts: Object.fromEntries(this.#retryAttempts)
        };
    }

    /**
     * Send message to popup with retry mechanism
     * @param {string} type Message type
     * @param {*} payload Message payload
     * @returns {Promise<boolean>} Success status
     */
    async sendToPopup(type, payload) {
        try {
            // Add message to queue
            const message = { type, payload, timestamp: Date.now() };
            await this.#queueMessage(message);

            // Try to process queue immediately
            return await this.#processMessageQueue();
        } catch (error) {
            this.handleError(error, ErrorType.MESSAGING, ErrorSeverity.MEDIUM, {
                method: 'sendToPopup',
                type,
                payload
            });
            return false;
        }
    }

    /**
     * Queue message for delivery
     * @private
     */
    async #queueMessage(message) {
        try {
            const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.#messageQueue.set(id, message);
            this.#retryAttempts.set(id, 0);

            // Save to storage
            await this.#savePendingMessages();

            this.log(LogLevel.DEBUG, '📥 Message queued', { id, type: message.type });
        } catch (error) {
            this.handleError(error, ErrorType.MESSAGING, ErrorSeverity.LOW, {
                method: '#queueMessage',
                message
            });
        }
    }

    /**
     * Process message queue
     * @private
     */
    async #processMessageQueue() {
        if (this.#isProcessingQueue) return;
        this.#isProcessingQueue = true;

        try {
            if (this.#messageQueue.size === 0) {
                return true;
            }

            // Check if popup is available
            if (this.#ports.size === 0) {
                this.log(LogLevel.DEBUG, '⏳ No popup connection available, messages queued');
                return false;
            }

            // Process each message
            for (const [id, message] of this.#messageQueue) {
                const attempts = this.#retryAttempts.get(id) || 0;
                
                if (attempts >= MAX_RETRY_ATTEMPTS) {
                    this.log(LogLevel.WARNING, `⚠️ Message ${id} exceeded retry limit, removing`);
                    this.#messageQueue.delete(id);
                    this.#retryAttempts.delete(id);
                    continue;
                }

                try {
                    // Send to all connected popups
                    const sendPromises = Array.from(this.#ports).map(port => 
                        new Promise(resolve => {
                            port.postMessage(message);
                            resolve();
                        })
                    );

                    await Promise.all(sendPromises);

                    // Message sent successfully
                    this.#messageQueue.delete(id);
                    this.#retryAttempts.delete(id);
                    this.log(LogLevel.SUCCESS, '✉️ Message sent successfully', { id, type: message.type });
                } catch (error) {
                    this.#retryAttempts.set(id, attempts + 1);
                    this.handleError(error, ErrorType.MESSAGING, ErrorSeverity.LOW, {
                        method: '#processMessageQueue',
                        id,
                        attempts
                    });
                }
            }

            // Save updated queue
            await this.#savePendingMessages();

            return this.#messageQueue.size === 0;
        } catch (error) {
            this.handleError(error, ErrorType.MESSAGING, ErrorSeverity.MEDIUM, {
                method: '#processMessageQueue'
            });
            return false;
        } finally {
            this.#isProcessingQueue = false;
        }
    }

    /**
     * Load pending messages from storage
     * @private
     */
    async #loadPendingMessages() {
        try {
            const data = await storageManager.get(MESSAGE_QUEUE_KEY);
            if (data) {
                for (const [id, message] of Object.entries(data)) {
                    this.#messageQueue.set(id, message);
                    this.#retryAttempts.set(id, 0);
                }
                this.log(LogLevel.INFO, `📥 Loaded ${this.#messageQueue.size} pending messages`);
            }
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                method: '#loadPendingMessages'
            });
        }
    }

    /**
     * Save pending messages to storage
     * @private
     */
    async #savePendingMessages() {
        try {
            if (this.#messageQueue.size === 0) {
                await storageManager.remove(MESSAGE_QUEUE_KEY);
            } else {
                await storageManager.set(MESSAGE_QUEUE_KEY, Object.fromEntries(this.#messageQueue));
            }
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                method: '#savePendingMessages'
            });
        }
    }

    /**
     * Clean up resources
     */
    async dispose() {
        try {
            // Close all ports
            for (const port of this.#ports) {
                try {
                    port.disconnect();
                } catch (error) {
                    this.log(LogLevel.WARNING, '⚠️ Error disconnecting port:', error);
                }
            }
            this.#ports.clear();

            // Save any pending messages
            await this.#savePendingMessages();

            // Clear maps
            this.#messageQueue.clear();
            this.#retryAttempts.clear();

            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.MEDIUM, {
                method: 'dispose'
            });
        }
    }
}

// Export singleton instance
export const messageManager = MessageManager.getInstance(); 