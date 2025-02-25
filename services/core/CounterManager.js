import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity, LogLevel } from '../constants.js';

const COUNTER_CONFIG = {
    ANIMATION_DURATION: 300, // ms
    UPDATE_DEBOUNCE: 100, // ms
    CACHE_TTL: 5 * 60 * 1000 // 5 minutes
};

/**
 * Manager for handling counters and their animations
 * @extends BaseManager
 */
class CounterManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;

    #counters = {};
    #updateTimeout = null;
    #pendingUpdates = new Map();

    constructor(registry) {
        if (CounterManager.#instance) {
            return CounterManager.#instance;
        }
        super(registry, 'CounterManager');
        CounterManager.#instance = this;
        CounterManager._registry = registry;
        
        this.addDependency('event');
        this.addDependency('store');
    }

    static getInstance() {
        if (!CounterManager.#instance && CounterManager._registry) {
            CounterManager.#instance = new CounterManager(CounterManager._registry);
        }
        return CounterManager.#instance;
    }

    static setRegistry(registry) {
        CounterManager._registry = registry;
    }

    /**
     * Initialize counter manager
     * @protected
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing counter manager...');
            
            // Get dependencies
            const eventManager = await this.getDependency('event');
            const storeManager = await this.getDependency('store');
            
            if (!eventManager?.isReady()) {
                throw new Error('EventManager must be ready');
            }

            // Load cached counters
            await this.#loadFromCache();

            // Setup event listeners
            await eventManager.on('counter:register', this.registerCounter.bind(this));
            await eventManager.on('counter:unregister', this.unregisterCounter.bind(this));
            await eventManager.on('counter:update', this.updateCounter.bind(this));

            this.log(LogLevel.SUCCESS, '✨ Counter manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: '_initialize'
            });
            return false;
        }
    }

    /**
     * Register new counter
     * @param {HTMLElement} element Counter element
     * @param {number} [initialValue=0] Initial counter value
     * @returns {Promise<void>}
     */
    async registerCounter(element, initialValue = 0) {
        try {
            const id = element.id;
            if (!id) {
                throw new Error('Counter element must have an ID');
            }

            // Store counter data
            this.#counters[id] = {
                element,
                value: initialValue,
                lastUpdate: Date.now()
            };

            // Set initial value
            element.textContent = initialValue;
            element.classList.toggle('count-zero', initialValue === 0);

            // Emit event
            const eventManager = await this.getDependency('event');
            await eventManager.emit('counter:registered', {
                id,
                value: initialValue,
                timestamp: Date.now()
            });

            this.log(LogLevel.DEBUG, '📊 Counter registered', { id, value: initialValue });
        } catch (error) {
            this.handleError(error, ErrorType.REGISTRATION, ErrorSeverity.MEDIUM, {
                method: 'registerCounter',
                element
            });
        }
    }

    /**
     * Unregister counter
     * @param {string} id Counter ID
     * @returns {Promise<void>}
     */
    async unregisterCounter(id) {
        try {
            if (!this.#counters[id]) {
                throw new Error(`Counter ${id} not found`);
            }

            // Remove from pending updates
            this.#pendingUpdates.delete(id);

            // Remove counter data
            delete this.#counters[id];

            // Emit event
            const eventManager = await this.getDependency('event');
            await eventManager.emit('counter:unregistered', {
                id,
                timestamp: Date.now()
            });

            this.log(LogLevel.DEBUG, '🗑️ Counter unregistered', { id });
        } catch (error) {
            this.handleError(error, ErrorType.REGISTRATION, ErrorSeverity.LOW, {
                method: 'unregisterCounter',
                id
            });
        }
    }

    /**
     * Update counter value
     * @param {string} id Counter ID
     * @param {number} value New value
     * @param {boolean} [animate=true] Whether to animate the change
     * @returns {Promise<void>}
     */
    async updateCounter(id, value, animate = true) {
        try {
            const counter = this.#counters[id];
            if (!counter) {
                throw new Error(`Counter ${id} not found`);
            }

            // Store update in pending queue
            this.#pendingUpdates.set(id, {
                value,
                animate,
                timestamp: Date.now()
            });

            // Debounce updates
            if (this.#updateTimeout) {
                clearTimeout(this.#updateTimeout);
            }

            this.#updateTimeout = setTimeout(
                () => this.#processPendingUpdates(),
                COUNTER_CONFIG.UPDATE_DEBOUNCE
            );
        } catch (error) {
            this.handleError(error, ErrorType.UPDATE, ErrorSeverity.LOW, {
                method: 'updateCounter',
                id,
                value
            });
        }
    }

    /**
     * Get counter value
     * @param {string} id Counter ID
     * @returns {Promise<number>}
     */
    async getCounterValue(id) {
        try {
            const counter = this.#counters[id];
            if (!counter) {
                throw new Error(`Counter ${id} not found`);
            }
            return counter.value;
        } catch (error) {
            this.handleError(error, ErrorType.READ, ErrorSeverity.LOW, {
                method: 'getCounterValue',
                id
            });
            return 0;
        }
    }

    /**
     * Process pending counter updates
     * @private
     */
    async #processPendingUpdates() {
        try {
            const updates = Array.from(this.#pendingUpdates.entries());
            this.#pendingUpdates.clear();

            for (const [id, update] of updates) {
                const counter = this.#counters[id];
                if (!counter) continue;

                const { value, animate } = update;
                const previousValue = counter.value;

                // Skip if no change
                if (value === previousValue) continue;

                // Update element
                counter.element.textContent = value;
                counter.element.classList.toggle('count-zero', value === 0);

                // Add animation classes if needed
                if (animate) {
                    if (value > previousValue) {
                        counter.element.classList.add('count-increased');
                    } else {
                        counter.element.classList.add('count-decreased');
                    }

                    // Remove animation classes after animation
                    setTimeout(() => {
                        counter.element.classList.remove('count-increased', 'count-decreased');
                    }, COUNTER_CONFIG.ANIMATION_DURATION);
                }

                // Update counter data
                counter.value = value;
                counter.lastUpdate = Date.now();

                // Save to cache
                await this.#saveToCache(id, value);

                // Emit event
                const eventManager = await this.getDependency('event');
                await eventManager.emit('counter:updated', {
                    id,
                    value,
                    previousValue,
                    timestamp: counter.lastUpdate
                });
            }
        } catch (error) {
            this.handleError(error, ErrorType.UPDATE, ErrorSeverity.MEDIUM, {
                method: '#processPendingUpdates'
            });
        }
    }

    /**
     * Load counters from cache
     * @private
     */
    async #loadFromCache() {
        try {
            const store = await this.getDependency('store');
            const cached = await store.get('counters');

            if (cached) {
                for (const [id, data] of Object.entries(cached)) {
                    const element = document.getElementById(id);
                    if (element && Date.now() - data.timestamp < COUNTER_CONFIG.CACHE_TTL) {
                        await this.registerCounter(element, data.value);
                    }
                }
            }
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.LOW, {
                method: '#loadFromCache'
            });
        }
    }

    /**
     * Save counter to cache
     * @private
     */
    async #saveToCache(id, value) {
        try {
            const store = await this.getDependency('store');
            const cached = await store.get('counters') || {};

            cached[id] = {
                value,
                timestamp: Date.now()
            };

            await store.set('counters', cached);
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.LOW, {
                method: '#saveToCache',
                id,
                value
            });
        }
    }

    /**
     * Clean up resources
     * @protected
     */
    async _dispose() {
        if (this.#updateTimeout) {
            clearTimeout(this.#updateTimeout);
            this.#updateTimeout = null;
        }
        this.#pendingUpdates.clear();
        this.#counters = {};
        await super._dispose();
    }

    /**
     * Get counter manager metrics
     * @returns {Object} Metrics object
     */
    getMetrics() {
        return {
            ...super.getMetrics(),
            counters: {
                total: Object.keys(this.#counters).length,
                pending: this.#pendingUpdates.size,
                lastUpdate: Math.max(
                    ...Object.values(this.#counters)
                        .map(c => c.lastUpdate)
                        .filter(Boolean)
                )
            }
        };
    }
}

// Export class only
export { CounterManager };