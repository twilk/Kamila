/**
 * Performance Monitoring Service for KAMILA
 * Tracks and reports performance metrics based on project requirements
 */

export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            marks: new Map(),
            measures: new Map(),
            frames: [],
            longTasks: [],
            layoutShifts: [],
            api: new Map(),
            memory: new Map(),
            accessibility: new Map()
        };

        this.observers = new Map();
        
        this.thresholds = {
            initialLoad: 2000,      // From Technical Requirements
            themeSwitch: 50,        // From Technical Goals
            apiResponse: 500,       // From Technical Requirements
            memoryLimit: 100,       // From Technical Goals (MB)
            frameTarget: 16.67,     // 60fps requirement
            cacheTimeout: 300000,   // 5-minute cache timeout
            layoutShift: 0.1,       // CLS threshold
            firstInput: 100         // FID threshold
        };

        this.initObservers();
    }

    /**
     * Initializes performance observers
     */
    initObservers() {
        if ('PerformanceObserver' in window) {
            try {
                // Long tasks observer
                const longTaskObserver = new PerformanceObserver(list => {
                    const entries = list.getEntries();
                    this.metrics.longTasks.push(...entries);
                    this.checkThresholds('longTask', entries);
                });
                longTaskObserver.observe({ entryTypes: ['longtask'] });
                this.observers.set('longTask', longTaskObserver);

                // Layout and paint observer
                const paintObserver = new PerformanceObserver(list => {
                    list.getEntries().forEach(entry => {
                        switch(entry.entryType) {
                            case 'layout-shift':
                                this.metrics.layoutShifts.push(entry);
                                this.checkThresholds('layoutShift', entry.value);
                                break;
                            case 'largest-contentful-paint':
                                this.checkThresholds('lcp', entry.startTime);
                                break;
                            case 'first-input':
                                this.checkThresholds('fid', entry.processingStart - entry.startTime);
                                break;
                        }
                    });
                });
                
                paintObserver.observe({ 
                    entryTypes: ['layout-shift', 'largest-contentful-paint', 'first-input'] 
                });
                this.observers.set('paint', paintObserver);

                // Resource timing
                const resourceObserver = new PerformanceObserver(list => {
                    list.getEntries().forEach(entry => {
                        if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
                            this.metrics.api.set(entry.name, entry.duration);
                            this.checkThresholds('apiResponse', entry.duration);
                        }
                    });
                });
                resourceObserver.observe({ entryTypes: ['resource'] });
                this.observers.set('resource', resourceObserver);

            } catch (error) {
                console.warn('Performance monitoring partially unavailable:', error);
            }
        }
    }

    /**
     * Starts performance measurement
     */
    startMeasure(name) {
        try {
            performance.mark(`${name}-start`);
            this.metrics.marks.set(name, performance.now());
            return true;
        } catch (error) {
            console.warn(`Failed to start measure ${name}:`, error);
            return false;
        }
    }

    /**
     * Ends performance measurement
     */
    endMeasure(name) {
        try {
            performance.mark(`${name}-end`);
            performance.measure(name, `${name}-start`, `${name}-end`);
            
            const duration = performance.now() - this.metrics.marks.get(name);
            this.metrics.measures.set(name, duration);
            
            this.checkThresholds(name, duration);
            return duration;
        } catch (error) {
            console.warn(`Failed to end measure ${name}:`, error);
            return 0;
        }
    }

    /**
     * Checks if metrics exceed thresholds
     */
    checkThresholds(metricName, value) {
        const threshold = this.thresholds[metricName];
        if (threshold && value > threshold) {
            const violation = {
                metric: metricName,
                value,
                threshold,
                timestamp: Date.now()
            };
            
            // Report violation to background script
            chrome.runtime.sendMessage({
                type: 'PERFORMANCE_VIOLATION',
                payload: violation
            });

            // Log to console in debug mode
            if (process.env.NODE_ENV === 'development') {
                console.warn('Performance threshold exceeded:', violation);
            }
        }
    }

    /**
     * Gets performance report
     */
    getReport() {
        return {
            metrics: {
                measures: Object.fromEntries(this.metrics.measures),
                api: Object.fromEntries(this.metrics.api),
                memory: Object.fromEntries(this.metrics.memory),
                accessibility: Object.fromEntries(this.metrics.accessibility)
            },
            violations: {
                longTasks: this.metrics.longTasks.length,
                layoutShifts: this.metrics.layoutShifts.length,
                totalBlockingTime: this.metrics.longTasks.reduce(
                    (sum, task) => sum + task.duration, 
                    0
                )
            },
            thresholds: this.thresholds
        };
    }

    /**
     * Cleans up resources
     */
    destroy() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        this.clearMetrics();
    }

    /**
     * Clears collected metrics
     */
    clearMetrics() {
        Object.keys(this.metrics).forEach(key => {
            if (this.metrics[key] instanceof Map) {
                this.metrics[key].clear();
            } else if (Array.isArray(this.metrics[key])) {
                this.metrics[key] = [];
            }
        });

        try {
            performance.clearMarks();
            performance.clearMeasures();
        } catch (error) {
            console.warn('Failed to clear performance entries:', error);
        }
    }
}

// Export the singleton instance
export const performanceMonitor = new PerformanceMonitor(); 