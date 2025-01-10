import { BaseManager } from './BaseManager';

/**
 * Manager for tracking system metrics and performance
 */
export class MetricsManager extends BaseManager {
    constructor() {
        super();
        this.metrics = {
            initialization: {
                totalTime: 0,
                componentTimes: new Map(),
                errors: []
            },
            memory: {
                lastCheck: 0,
                usage: []
            },
            performance: {
                operations: new Map(),
                timings: new Map()
            }
        };
        
        // Bind methods
        this.trackOperation = this.trackOperation.bind(this);
        this.trackTiming = this.trackTiming.bind(this);
        this.checkMemoryUsage = this.checkMemoryUsage.bind(this);
    }

    /**
     * Initialize metrics tracking
     */
    async onInitialize() {
        // Start periodic memory checks
        this.memoryCheckInterval = setInterval(this.checkMemoryUsage, 60000);
        
        // Initial memory check
        await this.checkMemoryUsage();
    }

    /**
     * Clean up metrics tracking
     */
    async onDispose() {
        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
        }
    }

    /**
     * Track an operation's execution time
     * @param {string} operation 
     * @param {function} fn 
     * @returns {Promise<any>}
     */
    async trackOperation(operation, fn) {
        const start = performance.now();
        try {
            const result = await fn();
            const duration = performance.now() - start;
            
            // Update operation metrics
            if (!this.metrics.performance.operations.has(operation)) {
                this.metrics.performance.operations.set(operation, {
                    count: 0,
                    totalTime: 0,
                    avgTime: 0,
                    lastTime: 0
                });
            }
            
            const stats = this.metrics.performance.operations.get(operation);
            stats.count++;
            stats.totalTime += duration;
            stats.avgTime = stats.totalTime / stats.count;
            stats.lastTime = duration;
            
            return result;
        } catch (error) {
            const duration = performance.now() - start;
            this.metrics.performance.operations.set(operation, {
                lastError: error,
                lastErrorTime: duration
            });
            throw error;
        }
    }

    /**
     * Track a timing metric
     * @param {string} name 
     * @param {number} value 
     */
    trackTiming(name, value) {
        if (!this.metrics.performance.timings.has(name)) {
            this.metrics.performance.timings.set(name, {
                min: value,
                max: value,
                avg: value,
                count: 1,
                total: value,
                last: value
            });
            return;
        }

        const stats = this.metrics.performance.timings.get(name);
        stats.count++;
        stats.total += value;
        stats.avg = stats.total / stats.count;
        stats.min = Math.min(stats.min, value);
        stats.max = Math.max(stats.max, value);
        stats.last = value;
    }

    /**
     * Check memory usage
     */
    async checkMemoryUsage() {
        if (performance.memory) {
            const memory = {
                timestamp: Date.now(),
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            };
            
            this.metrics.memory.usage.push(memory);
            this.metrics.memory.lastCheck = Date.now();
            
            // Keep only last hour of memory stats
            const oneHourAgo = Date.now() - 3600000;
            this.metrics.memory.usage = this.metrics.memory.usage.filter(
                stat => stat.timestamp > oneHourAgo
            );
        }
    }

    /**
     * Get current metrics
     * @returns {Object}
     */
    getMetrics() {
        return {
            initialization: {
                ...this.metrics.initialization,
                componentTimes: Object.fromEntries(this.metrics.initialization.componentTimes)
            },
            memory: {
                lastCheck: this.metrics.memory.lastCheck,
                currentUsage: this.metrics.memory.usage[this.metrics.memory.usage.length - 1],
                history: this.metrics.memory.usage
            },
            performance: {
                operations: Object.fromEntries(this.metrics.performance.operations),
                timings: Object.fromEntries(this.metrics.performance.timings)
            }
        };
    }

    /**
     * Clear metrics
     */
    clearMetrics() {
        this.metrics.initialization.componentTimes.clear();
        this.metrics.initialization.errors = [];
        this.metrics.memory.usage = [];
        this.metrics.performance.operations.clear();
        this.metrics.performance.timings.clear();
    }
} 