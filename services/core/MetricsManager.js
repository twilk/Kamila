import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';

/**
 * Get the singleton instance of MetricsManager
 * @returns {MetricsManager}
 */
export const getMetricsManager = () => MetricsManager.getInstance();

export class MetricsManager extends BaseManager {
    static MEMORY_CHECK_INTERVAL = 30000; // 30 seconds
    static METRICS_RETENTION = 3600000; // 1 hour
    static _instance = null;

    static getInstance() {
        if (!MetricsManager._instance) {
            MetricsManager._instance = new MetricsManager();
        }
        return MetricsManager._instance;
    }

    constructor() {
        if (MetricsManager._instance) {
            throw new Error('MetricsManager is a singleton. Use MetricsManager.getInstance() instead.');
        }
        super('MetricsManager');
        this.metrics = {
            initialization: {
                totalTime: 0,
                componentTimes: new Map(),
                errors: []
            },
            memory: {
                lastCheck: 0,
                usage: [],
                alerts: []
            },
            performance: {
                operations: new Map(),
                timings: new Map(),
                longTasks: [],
                frameDrops: []
            },
            errors: {
                count: 0,
                lastError: null,
                errorTypes: new Map()
            }
        };
        
        this.observers = {
            performance: null,
            memory: null,
            frames: null
        };
        MetricsManager._instance = this;
    }

    async onInitialize() {
        try {
            this.log(LogLevel.INFO, 'Setting up performance monitoring');
            // Start performance monitoring
            this.setupPerformanceObserver();
            
            this.log(LogLevel.INFO, 'Starting memory monitoring');
            // Start memory monitoring
            this.startMemoryMonitoring();
            
            this.log(LogLevel.INFO, 'Setting up frame monitoring');
            // Start frame monitoring
            this.setupFrameMonitoring();

            this.log(LogLevel.SUCCESS, 'All monitoring systems initialized', {
                observers: Object.keys(this.observers),
                metrics: Object.keys(this.metrics)
            });
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.ERROR, {
                method: 'onInitialize'
            });
            return false;
        }
    }

    setupPerformanceObserver() {
        if ('PerformanceObserver' in window) {
            // Monitor long tasks
            this.observers.performance = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'longtask') {
                        this.metrics.performance.longTasks.push({
                            timestamp: entry.startTime,
                            duration: entry.duration,
                            name: entry.name
                        });
                        this.log(LogLevel.WARN, 'Long task detected', {
                            duration: entry.duration,
                            name: entry.name
                        });
                    }
                }
            });

            try {
                this.observers.performance.observe({ entryTypes: ['longtask'] });
                this.log(LogLevel.INFO, 'Performance observer initialized');
            } catch (e) {
                this.handleError(e, ErrorType.METRICS, ErrorSeverity.WARNING, {
                    method: 'setupPerformanceObserver'
                });
            }
        } else {
            this.log(LogLevel.WARN, 'PerformanceObserver not available');
        }
    }

    setupFrameMonitoring() {
        if ('requestAnimationFrame' in window) {
            let lastFrameTime = performance.now();
            
            const checkFrame = () => {
                const currentTime = performance.now();
                const frameDelta = currentTime - lastFrameTime;
                
                // Detect dropped frames (assuming 60fps)
                if (frameDelta > 20) { // More than 1 frame at 60fps
                    this.metrics.performance.frameDrops.push({
                        timestamp: currentTime,
                        delta: frameDelta
                    });
                }
                
                lastFrameTime = currentTime;
                requestAnimationFrame(checkFrame);
            };
            
            requestAnimationFrame(checkFrame);
        }
    }

    startMemoryMonitoring() {
        setInterval(() => this.checkMemoryUsage(), MetricsManager.MEMORY_CHECK_INTERVAL);
    }

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
            
            // Check for memory leaks
            if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
                this.metrics.memory.alerts.push({
                    timestamp: Date.now(),
                    type: 'HIGH_MEMORY_USAGE',
                    value: memory.usedJSHeapSize
                });
                
                this.emit('memoryAlert', {
                    type: 'HIGH_MEMORY_USAGE',
                    usage: memory
                });
            }
            
            // Keep only recent metrics
            const cutoff = Date.now() - MetricsManager.METRICS_RETENTION;
            this.metrics.memory.usage = this.metrics.memory.usage.filter(
                stat => stat.timestamp > cutoff
            );
        }
    }

    /**
     * Track timing for an operation
     * @param {string} name Operation name
     * @param {number} duration Duration in milliseconds
     */
    trackTiming(name, duration) {
        try {
            if (!this.metrics.performance.timings.has(name)) {
                this.metrics.performance.timings.set(name, {
                    count: 0,
                    total: 0,
                    min: Infinity,
                    max: -Infinity,
                    average: 0
                });
            }

            const timing = this.metrics.performance.timings.get(name);
            timing.count++;
            timing.total += duration;
            timing.min = Math.min(timing.min, duration);
            timing.max = Math.max(timing.max, duration);
            timing.average = timing.total / timing.count;

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.METRICS, ErrorSeverity.WARNING, {
                method: 'trackTiming',
                name,
                duration
            });
            return false;
        }
    }

    /**
     * Track an operation with timing
     * @param {string} name Operation name
     * @param {Function} operation Operation to track
     * @returns {Promise<any>} Operation result
     */
    async trackOperation(name, operation) {
        const start = performance.now();
        try {
            const result = await operation();
            const duration = performance.now() - start;
            this.trackTiming(name, duration);
            return result;
        } catch (error) {
            const duration = performance.now() - start;
            this.trackTiming(`${name}_error`, duration);
            throw error;
        }
    }

    trackError(error, context = '') {
        this.metrics.errors.count++;
        this.metrics.errors.lastError = {
            timestamp: Date.now(),
            error,
            context
        };
        
        const errorType = error.name || 'Unknown';
        const typeCount = this.metrics.errors.errorTypes.get(errorType) || 0;
        this.metrics.errors.errorTypes.set(errorType, typeCount + 1);
    }

    getMetrics() {
        return {
            initialization: {
                ...this.metrics.initialization,
                componentTimes: Object.fromEntries(this.metrics.initialization.componentTimes)
            },
            memory: {
                lastCheck: this.metrics.memory.lastCheck,
                currentUsage: this.metrics.memory.usage[this.metrics.memory.usage.length - 1],
                alerts: this.metrics.memory.alerts,
                history: this.metrics.memory.usage
            },
            performance: {
                operations: Object.fromEntries(this.metrics.performance.operations),
                timings: Object.fromEntries(this.metrics.performance.timings),
                longTasks: this.metrics.performance.longTasks,
                frameDrops: this.metrics.performance.frameDrops
            },
            errors: {
                count: this.metrics.errors.count,
                lastError: this.metrics.errors.lastError,
                byType: Object.fromEntries(this.metrics.errors.errorTypes)
            }
        };
    }

    async dispose() {
        try {
            // Stop all observers
            Object.values(this.observers).forEach(observer => {
                if (observer) {
                    try {
                        observer.disconnect();
                    } catch (e) {
                        // Ignore
                    }
                }
            });
            
            // Clear metrics
            this.metrics = {
                initialization: {
                    totalTime: 0,
                    componentTimes: new Map(),
                    errors: []
                },
                memory: {
                    lastCheck: 0,
                    usage: [],
                    alerts: []
                },
                performance: {
                    operations: new Map(),
                    timings: new Map(),
                    longTasks: [],
                    frameDrops: []
                },
                errors: {
                    count: 0,
                    lastError: null,
                    errorTypes: new Map()
                }
            };

            // Clear singleton instance
            MetricsManager._instance = null;
            
            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 