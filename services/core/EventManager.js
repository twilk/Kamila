import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';

export class EventManager extends BaseManager {
    constructor(metricsManager) {
        super();
        this.metricsManager = metricsManager;
        this.delegatedEvents = new Map();
        this.eventMetrics = new Map();
        this.debounceTimers = new Map();
        this.throttleTimers = new Map();
        this.boundHandleEvent = this.handleEvent.bind(this);
    }

    async onInitialize() {
        // Start listening for delegated events
        document.addEventListener('click', this.boundHandleEvent, true);
        document.addEventListener('input', this.boundHandleEvent, true);
        document.addEventListener('change', this.boundHandleEvent, true);
        document.addEventListener('submit', this.boundHandleEvent, true);
        
        return true;
    }

    /**
     * Delegate an event
     * @param {string} eventType - Type of event (click, input, etc)
     * @param {string} selector - CSS selector for target elements
     * @param {Function} handler - Event handler
     * @param {Object} options - Options for event handling
     */
    delegate(eventType, selector, handler, options = {}) {
        const key = `${eventType}:${selector}`;
        if (!this.delegatedEvents.has(key)) {
            this.delegatedEvents.set(key, new Set());
        }
        
        const handlerConfig = {
            handler,
            options: {
                debounce: options.debounce || 0,
                throttle: options.throttle || 0,
                capture: options.capture || false,
                once: options.once || false,
                passive: options.passive || false
            }
        };

        this.delegatedEvents.get(key).add(handlerConfig);
        
        // Initialize metrics for this event type
        if (!this.eventMetrics.has(key)) {
            this.eventMetrics.set(key, {
                calls: 0,
                totalTime: 0,
                maxTime: 0,
                lastTime: 0
            });
        }

        return () => this.undelegate(eventType, selector, handler);
    }

    /**
     * Remove event delegation
     */
    undelegate(eventType, selector, handler) {
        const key = `${eventType}:${selector}`;
        const handlers = this.delegatedEvents.get(key);
        
        if (handlers) {
            handlers.forEach(config => {
                if (config.handler === handler) {
                    handlers.delete(config);
                }
            });
            
            if (handlers.size === 0) {
                this.delegatedEvents.delete(key);
            }
        }
    }

    /**
     * Handle delegated event
     */
    async handleEvent(event) {
        const startTime = performance.now();
        const eventType = event.type;
        let handled = false;

        try {
            for (const [key, handlers] of this.delegatedEvents.entries()) {
                const [type, selector] = key.split(':');
                if (type !== eventType) continue;

                // Find matching target
                const target = event.target.closest(selector);
                if (!target) continue;

                // Execute handlers
                for (const { handler, options } of handlers) {
                    try {
                        if (options.debounce > 0) {
                            this.debounce(key, handler, options.debounce, event, target);
                            handled = true;
                            continue;
                        }

                        if (options.throttle > 0) {
                            this.throttle(key, handler, options.throttle, event, target);
                            handled = true;
                            continue;
                        }

                        await this.executeHandler(key, handler, event, target);
                        handled = true;

                        if (options.once) {
                            this.undelegate(type, selector, handler);
                        }
                    } catch (error) {
                        this.handleError(error, ErrorType.EVENT, ErrorSeverity.ERROR, {
                            eventType,
                            selector,
                            target
                        });
                    }
                }
            }

            // Update metrics
            const duration = performance.now() - startTime;
            this.updateMetrics(eventType, duration, handled);

        } catch (error) {
            this.handleError(error, ErrorType.EVENT, ErrorSeverity.ERROR, {
                eventType
            });
        }
    }

    /**
     * Execute event handler with metrics tracking
     */
    async executeHandler(key, handler, event, target) {
        const start = performance.now();
        
        try {
            await handler.call(target, event, target);
        } finally {
            const duration = performance.now() - start;
            
            // Update metrics
            const metrics = this.eventMetrics.get(key);
            if (metrics) {
                metrics.calls++;
                metrics.totalTime += duration;
                metrics.maxTime = Math.max(metrics.maxTime, duration);
                metrics.lastTime = duration;
            }

            // Track in metrics manager
            this.metricsManager?.trackOperation(`event_${key}`, () => duration);
        }
    }

    /**
     * Debounce event handler
     */
    debounce(key, handler, delay, event, target) {
        const timerKey = `${key}:${handler.name}`;
        
        if (this.debounceTimers.has(timerKey)) {
            clearTimeout(this.debounceTimers.get(timerKey));
        }

        this.debounceTimers.set(timerKey, setTimeout(async () => {
            await this.executeHandler(key, handler, event, target);
            this.debounceTimers.delete(timerKey);
        }, delay));
    }

    /**
     * Throttle event handler
     */
    throttle(key, handler, limit, event, target) {
        const timerKey = `${key}:${handler.name}`;
        
        if (!this.throttleTimers.has(timerKey)) {
            this.executeHandler(key, handler, event, target);
            
            this.throttleTimers.set(timerKey, setTimeout(() => {
                this.throttleTimers.delete(timerKey);
            }, limit));
        }
    }

    /**
     * Update event metrics
     */
    updateMetrics(eventType, duration, handled) {
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
     */
    getMetrics() {
        return Object.fromEntries(this.eventMetrics);
    }

    async dispose() {
        // Remove event listeners
        document.removeEventListener('click', this.boundHandleEvent, true);
        document.removeEventListener('input', this.boundHandleEvent, true);
        document.removeEventListener('change', this.boundHandleEvent, true);
        document.removeEventListener('submit', this.boundHandleEvent, true);

        // Clear all timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.throttleTimers.forEach(timer => clearTimeout(timer));

        // Clear collections
        this.delegatedEvents.clear();
        this.eventMetrics.clear();
        this.debounceTimers.clear();
        this.throttleTimers.clear();

        await super.dispose();
    }
} 