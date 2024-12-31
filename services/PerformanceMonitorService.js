import { logService } from './LogService.js';

/**
 * Serwis do monitorowania wydajności aplikacji
 */
export class PerformanceMonitorService {
    constructor() {
        this.initialized = false;
        this.metrics = new Map();
        this.observers = new Set();
        logService.info('PerformanceMonitorService constructed');
    }

    async initialize() {
        if (this.initialized) {
            logService.debug('PerformanceMonitorService already initialized');
            return;
        }

        try {
            logService.info('Initializing PerformanceMonitorService...');
            
            // Initialize performance observers
            this.setupObservers();
            
            // Start collecting basic metrics
            this.startMetricsCollection();
            
            this.initialized = true;
            logService.info('PerformanceMonitorService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize PerformanceMonitorService', error);
            // Don't throw, continue with basic functionality
            this.initialized = true;
        }
    }

    setupObservers() {
        try {
            // Setup performance observer for long tasks
            if (window.PerformanceObserver) {
                const longTaskObserver = new PerformanceObserver(list => {
                    list.getEntries().forEach(entry => {
                        this.recordMetric('longTask', entry.duration);
                    });
                });
                
                longTaskObserver.observe({ entryTypes: ['longtask'] });
                this.observers.add(longTaskObserver);
            }
            
            logService.debug('Performance observers setup complete');
        } catch (error) {
            logService.error('Failed to setup performance observers:', error);
        }
    }

    startMetricsCollection() {
        try {
            // Record basic metrics
            this.recordMetric('jsHeapSize', performance.memory?.usedJSHeapSize);
            this.recordMetric('totalJSHeapSize', performance.memory?.totalJSHeapSize);
            this.recordMetric('jsHeapLimit', performance.memory?.jsHeapSizeLimit);
            
            // Setup periodic collection
            setInterval(() => {
                this.collectMetrics();
            }, 60000); // Collect every minute
            
            logService.debug('Metrics collection started');
        } catch (error) {
            logService.error('Failed to start metrics collection:', error);
        }
    }

    collectMetrics() {
        try {
            const metrics = {
                jsHeapSize: performance.memory?.usedJSHeapSize,
                totalJSHeapSize: performance.memory?.totalJSHeapSize,
                jsHeapLimit: performance.memory?.jsHeapSizeLimit,
                timestamp: Date.now()
            };
            
            Object.entries(metrics).forEach(([key, value]) => {
                this.recordMetric(key, value);
            });
        } catch (error) {
            logService.error('Failed to collect metrics:', error);
        }
    }

    recordMetric(name, value) {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }
        
        const metricHistory = this.metrics.get(name);
        metricHistory.push({
            value,
            timestamp: Date.now()
        });
        
        // Keep only last 100 measurements
        if (metricHistory.length > 100) {
            metricHistory.shift();
        }
    }

    getMetric(name) {
        return this.metrics.get(name) || [];
    }

    getAllMetrics() {
        const result = {};
        this.metrics.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    cleanup() {
        try {
            logService.debug('Cleaning up PerformanceMonitorService...');
            
            // Disconnect all observers
            this.observers.forEach(observer => {
                try {
                    observer.disconnect();
                } catch (error) {
                    logService.error('Failed to disconnect observer:', error);
                }
            });
            
            this.observers.clear();
            this.metrics.clear();
            this.initialized = false;
            
            logService.debug('PerformanceMonitorService cleaned up successfully');
        } catch (error) {
            logService.error('Error during cleanup:', error);
        }
    }
}

export const performanceMonitorService = new PerformanceMonitorService(); 