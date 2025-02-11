import { BaseManager } from './BaseManager.js';
import { EventType, ErrorType, ErrorSeverity, LogLevel } from './EventType.js';

/**
 * @extends {BaseManager}
 * Manages event delegation and handling
 */
export class EventManager extends BaseManager {
    static #instance = null;
    #delegatedEvents = new Map();
    #eventMetrics = new Map();
    #debounceTimers = new Map();
    #throttleTimers = new Map();
    #boundHandleEvent = null;
    #customEventHandlers = new Map();

    constructor() {
        if (EventManager.#instance) {
            return EventManager.#instance;
        }
        super('EventManager');
        EventManager.#instance = this;
        this.#boundHandleEvent = this.#handleEvent.bind(this);
    }

    /**
     * Get singleton instance
     * @returns {EventManager}
     */
    static getInstance() {
        if (!EventManager.#instance) {
            EventManager.#instance = new EventManager();
        }
        return EventManager.#instance;
    }

    /**
     * Initialize event manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            // Setup event delegation
            document.addEventListener('click', this.#boundHandleEvent, true);
            document.addEventListener('input', this.#boundHandleEvent, true);
            document.addEventListener('change', this.#boundHandleEvent, true);
            document.addEventListener('submit', this.#boundHandleEvent, true);

            this.log(LogLevel.SUCCESS, '✅ Event manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
    }

    /**
     * Add delegated event handler
     * @param {string} selector CSS selector
     * @param {string} eventType Event type
     * @param {Function} handler Event handler
     * @param {Object} [options] Event options
     */
    delegate(selector, eventType, handler, options = {}) {
        const key = `${selector}:${eventType}`;
        if (!this.#delegatedEvents.has(key)) {
            this.#delegatedEvents.set(key, new Set());
        }
        this.#delegatedEvents.get(key).add({
            handler,
            options
        });
    }

    /**
     * Remove delegated event handler
     * @param {string} selector CSS selector
     * @param {string} eventType Event type
     * @param {Function} handler Event handler
     */
    undelegate(selector, eventType, handler) {
        const key = `${selector}:${eventType}`;
        const handlers = this.#delegatedEvents.get(key);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.#delegatedEvents.delete(key);
            }
        }
    }

    /**
     * Handle delegated event
     * @private
     */
    #handleEvent(event) {
        const startTime = performance.now();
        let handled = false;

        for (const [key, handlers] of this.#delegatedEvents) {
            const [selector] = key.split(':');
            if (event.target.matches(selector)) {
                handlers.forEach(({ handler, options }) => {
                    try {
                        if (options.throttle) {
                            this.#throttle(key, handler, options.throttle, event, event.target);
                        } else if (options.debounce) {
                            this.#debounce(key, handler, options.debounce, event, event.target);
                        } else {
                            this.#executeHandler(key, handler, event, event.target);
                        }
                        handled = true;
                    } catch (error) {
                        this.handleError(error, ErrorType.EVENT, ErrorSeverity.MEDIUM, {
                            method: 'handleEvent',
                            selector,
                            eventType: event.type
                        });
                    }
                });
            }
        }

        const duration = performance.now() - startTime;
        this.#updateMetrics(event.type, duration, handled);
    }

    /**
     * Execute event handler
     * @private
     */
    #executeHandler(key, handler, event, target) {
        try {
            handler.call(target, event, target);
        } catch (error) {
            this.handleError(error, ErrorType.EVENT, ErrorSeverity.MEDIUM, {
                method: 'executeHandler',
                key
            });
        }
    }

    /**
     * Debounce event handler
     * @private
     */
    #debounce(key, handler, delay, event, target) {
        const timerKey = `${key}:${handler.name}`;
        
        if (this.#debounceTimers.has(timerKey)) {
            clearTimeout(this.#debounceTimers.get(timerKey));
        }
        
        this.#debounceTimers.set(timerKey, setTimeout(() => {
            this.#executeHandler(key, handler, event, target);
            this.#debounceTimers.delete(timerKey);
        }, delay));
    }

    /**
     * Throttle event handler
     * @private
     */
    #throttle(key, handler, limit, event, target) {
        const timerKey = `${key}:${handler.name}`;
        
        if (!this.#throttleTimers.has(timerKey)) {
            this.#executeHandler(key, handler, event, target);
            
            this.#throttleTimers.set(timerKey, setTimeout(() => {
                this.#throttleTimers.delete(timerKey);
            }, limit));
        }
    }

    /**
     * Update event metrics
     * @private
     */
    #updateMetrics(eventType, duration, handled) {
        const metrics = {
            timestamp: Date.now(),
            type: eventType,
            duration,
            handled
        };

        this.emit('eventMetrics', metrics);
        
        if (duration > 16.67) { // Longer than one frame (60fps)
            this.emit('longEvent', {
                ...metrics,
                threshold: 16.67
            });
        }
    }

    /**
     * Get event metrics
     * @returns {Object} Event metrics
     */
    getMetrics() {
        return Object.fromEntries(this.#eventMetrics);
    }

    /**
     * Subscribe to an event
     * @param {string} eventName Event name
     * @param {Function} handler Event handler
     * @param {Object} [options] Event options
     */
    on(eventName, handler, options = {}) {
        if (!this.#customEventHandlers.has(eventName)) {
            this.#customEventHandlers.set(eventName, new Set());
        }
        this.#customEventHandlers.get(eventName).add({ handler, options });
        
        this.log(LogLevel.DEBUG, `📌 Subscribed to event: ${eventName}`, { 
            handler: handler.name || 'anonymous'
        });
    }

    /**
     * Unsubscribe from an event
     * @param {string} eventName Event name
     * @param {Function} handler Event handler
     */
    off(eventName, handler) {
        const handlers = this.#customEventHandlers.get(eventName);
        if (handlers) {
            handlers.forEach(h => {
                if (h.handler === handler) {
                    handlers.delete(h);
                }
            });
            if (handlers.size === 0) {
                this.#customEventHandlers.delete(eventName);
            }
        }
        
        this.log(LogLevel.DEBUG, `🗑️ Unsubscribed from event: ${eventName}`, { 
            handler: handler.name || 'anonymous'
        });
    }

    /**
     * Emit an event
     * @param {string} eventName Event name
     * @param {*} data Event data
     */
    emit(eventName, data = {}) {
        const handlers = this.#customEventHandlers.get(eventName);
        if (handlers) {
            handlers.forEach(({ handler, options }) => {
                try {
                    if (options.throttle) {
                        this.#throttle(`custom:${eventName}`, () => handler(data), options.throttle);
                    } else if (options.debounce) {
                        this.#debounce(`custom:${eventName}`, () => handler(data), options.debounce);
                    } else {
                        handler(data);
                    }
                } catch (error) {
                    this.handleError(error, ErrorType.EVENT, ErrorSeverity.MEDIUM, {
                        method: 'emit',
                        eventName,
                        data
                    });
                }
            });
        }

        // Also emit as DOM event for broader compatibility
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
        
        this.log(LogLevel.DEBUG, `📢 Emitted event: ${eventName}`, { data });
    }

    /**
     * Clean up resources
     */
    async dispose() {
        try {
            // Remove event listeners
            document.removeEventListener('click', this.#boundHandleEvent, true);
            document.removeEventListener('input', this.#boundHandleEvent, true);
            document.removeEventListener('change', this.#boundHandleEvent, true);
            document.removeEventListener('submit', this.#boundHandleEvent, true);

            // Clear all timers
            this.#debounceTimers.forEach(timer => clearTimeout(timer));
            this.#throttleTimers.forEach(timer => clearTimeout(timer));

            // Clear collections
            this.#delegatedEvents.clear();
            this.#eventMetrics.clear();
            this.#debounceTimers.clear();
            this.#throttleTimers.clear();
            this.#customEventHandlers.clear();

            // Reset state
            this.#boundHandleEvent = null;

            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
            throw error;
        }
    }
}

// Export only the singleton instance
export const eventManager = EventManager.getInstance(); 