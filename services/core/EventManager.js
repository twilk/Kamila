import { BaseManager } from './BaseManager.js';
import { LogLevel, ErrorType, ErrorSeverity } from '../constants.js';

const EVENT_QUEUE_CONFIG = {
    MAX_QUEUE_SIZE: 1000,
    MAX_LISTENERS: 100,
    PROCESS_INTERVAL: 100,
    BATCH_SIZE: 50
};

/**
 * @extends {BaseManager}
 * Manages event delegation and handling
 */
class EventManager extends BaseManager {
    static #instance = null;
    static _registry = null;
    
    /** @private */
    #listeners = new Map();
    
    /** @private */
    #subscribers = new Map();
    
    /** @private */
    #eventQueue = [];
    
    /** @private */
    #queueProcessInterval = null;
    
    /** @private */
    #processing = false;

    constructor(registry) {
        if (EventManager.#instance) {
            return EventManager.#instance;
        }
        super(registry, 'EventManager');
        EventManager.#instance = this;
        EventManager._registry = registry;
        
        // Add dependencies
        this.addDependency('error');
    }

    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing event manager...');
            
            // Start queue processor
            this.#queueProcessInterval = setInterval(
                () => this.#processEventQueue(),
                EVENT_QUEUE_CONFIG.PROCESS_INTERVAL
            );
            
            this.log(LogLevel.SUCCESS, '✅ Event manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Get singleton instance
     * @returns {EventManager}
     */
    static getInstance() {
        if (!EventManager.#instance && EventManager._registry) {
            EventManager.#instance = new EventManager(EventManager._registry);
        }
        return EventManager.#instance;
    }

    /**
     * Set registry for all instances
     * @param {ManagerRegistry} registry Manager registry
     */
    static setRegistry(registry) {
        EventManager._registry = registry;
    }

    /**
     * Execute with retry logic
     * @private
     */
    async #executeWithRetry(fn, maxAttempts = 3, retryDelay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Emit an event
     * @param {string} eventName Event name
     * @param {Object} data Event data
     */
    async emit(eventName, data = {}) {
        try {
            if (!this.isReady()) {
                console.log('💩 [EVENT] Manager not ready, queueing:', eventName);
                return this.#queueEvent(eventName, data);
            }

            const listeners = this.#listeners.get(eventName) || [];
            console.log('💩 [EVENT] Emitting:', {
                event: eventName,
                listenersCount: listeners.size,
                data
            });

            const timestamp = Date.now();
            const eventData = {
                ...data,
                eventName,
                timestamp
            };

            this.log(LogLevel.DEBUG, `📢 Emitting ${eventName}`, eventData);

            if (listeners.size === 0) {
                console.log('💩 [EVENT] No listeners for:', eventName);
                return;
            }

            const promises = Array.from(listeners).map(listener => 
                this.#executeWithRetry(
                    async () => {
                        console.log('💩 [EVENT] Calling listener:', {
                            event: eventName,
                            listener: listener.name || 'anonymous'
                        });
                        return await listener(eventData);
                    }
                ).catch(error => {
                    console.log('💩 [EVENT] Listener error:', {
                        event: eventName,
                        listener: listener.name || 'anonymous',
                        error
                    });
                    this.handleError(error, ErrorType.EVENT_LISTENER, ErrorSeverity.LOW, {
                        eventName,
                        listener: listener.name || 'anonymous'
                    });
                })
            );

            await Promise.all(promises);
            console.log('💩 [EVENT] All listeners completed for:', eventName);
        } catch (error) {
            console.log('💩 [EVENT] Emission error:', {
                event: eventName,
                error
            });
            this.handleError(error, ErrorType.EVENT_EMISSION, ErrorSeverity.MEDIUM, {
                eventName,
                data
            });
        }
    }

    /**
     * Add event listener
     * @param {string} eventName Event name
     * @param {Function} listener Listener function
     * @returns {Promise<boolean>} True if listener was added
     */
    async on(eventName, listener) {
        try {
            if (typeof listener !== 'function') {
                throw new Error('Listener must be a function');
            }

            if (!this.#listeners.has(eventName)) {
                this.#listeners.set(eventName, new Set());
            }

            const listeners = this.#listeners.get(eventName);

            if (listeners.size >= EVENT_QUEUE_CONFIG.MAX_LISTENERS) {
                throw new Error(`Max listeners (${EVENT_QUEUE_CONFIG.MAX_LISTENERS}) exceeded for event: ${eventName}`);
            }

            listeners.add(listener);
            this.log(LogLevel.DEBUG, `👂 Added listener for ${eventName}`, {
                listenerName: listener.name || 'anonymous',
                totalListeners: listeners.size
            });
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.EVENT_LISTENER_REGISTRATION, ErrorSeverity.MEDIUM, {
                eventName,
                listener: listener?.name || 'anonymous'
            });
            return false;
        }
    }

    /**
     * Remove event listener
     * @param {string} eventName Event name
     * @param {Function} listener Listener function
     * @returns {Promise<boolean>} True if listener was removed
     */
    async off(eventName, listener) {
        try {
            const listeners = this.#listeners.get(eventName);
            if (!listeners) return false;

            const removed = listeners.delete(listener);
            if (removed) {
                this.log(LogLevel.DEBUG, `🗑️ Removed listener for ${eventName}`, {
                    listenerName: listener.name || 'anonymous',
                    remainingListeners: listeners.size
                });
            }
            
            if (listeners.size === 0) {
                this.#listeners.delete(eventName);
            }
            
            return removed;
        } catch (error) {
            this.handleError(error, ErrorType.EVENT_LISTENER_REMOVAL, ErrorSeverity.LOW, {
                eventName,
                listener: listener?.name || 'anonymous'
            });
            return false;
        }
    }

    /**
     * Queue event for later processing
     * @private
     */
    #queueEvent(eventName, data) {
        if (this.#eventQueue.length >= EVENT_QUEUE_CONFIG.MAX_QUEUE_SIZE) {
            this.log(LogLevel.WARN, `⚠️ Event queue full, dropping oldest event`);
            this.#eventQueue.shift();
        }

        this.#eventQueue.push({
            eventName,
            data,
            timestamp: Date.now()
        });

        this.log(LogLevel.DEBUG, `📥 Queued event: ${eventName}`, {
            queueSize: this.#eventQueue.length
        });
    }

    /**
     * Process event queue
     * @private
     */
    async #processEventQueue() {
        if (this.#processing || this.#eventQueue.length === 0) return;

        this.#processing = true;
        
        try {
            const batch = this.#eventQueue.splice(0, EVENT_QUEUE_CONFIG.BATCH_SIZE);
            
            for (const event of batch) {
                await this.emit(event.eventName, event.data);
            }

            if (this.#eventQueue.length > 0) {
                this.log(LogLevel.DEBUG, `📊 Processed ${batch.length} events, ${this.#eventQueue.length} remaining`);
            }
        } catch (error) {
            this.handleError(error, ErrorType.EVENT_QUEUE_PROCESSING, ErrorSeverity.MEDIUM);
        } finally {
            this.#processing = false;
        }
    }

    /**
     * Get event manager stats
     */
    getStats() {
        return {
            queueSize: this.#eventQueue.length,
            listenerCount: Array.from(this.#listeners.entries()).reduce(
                (acc, [event, listeners]) => ({
                    ...acc,
                    [event]: listeners.size
                }),
                {}
            ),
            isProcessing: this.#processing
        };
    }

    /**
     * Subscribe to an event
     * @param {string} eventName Event name
     * @param {Function} callback Callback function
     */
    async subscribe(eventName, callback) {
        return this.on(eventName, callback);
    }

    /**
     * Unsubscribe from an event
     * @param {string} eventName Event name
     * @param {Function} callback Callback function
     */
    async unsubscribe(eventName, callback) {
        return this.off(eventName, callback);
    }

    /**
     * Dispose event manager
     */
    async dispose() {
        if (this.#queueProcessInterval) {
            clearInterval(this.#queueProcessInterval);
            this.#queueProcessInterval = null;
        }

        this.#eventQueue = [];
        this.#listeners.clear();
        this.#subscribers.clear();
        this.#processing = false;

        await super.dispose();
    }
}

// Export class only
export { EventManager }; 