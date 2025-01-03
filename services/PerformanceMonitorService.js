import { logService } from './LogService.js';

/**
 * Serwis do monitorowania wydajności aplikacji
 */
export class PerformanceMonitorService {
    constructor() {
        this.metrics = {
            memory: {},
            performance: {},
            system: {
                memory: 0,
                cpu: 0,
                fps: 0
            }
        };
        this.listeners = new Set();
        this.updateInterval = 1000; // 1 second
        this.intervalId = null;
        logService.info('PerformanceMonitorService constructed');
    }

    async initialize() {
        try {
            logService.info('Initializing PerformanceMonitorService...');
            
            // Start monitoring
            this.startMonitoring();
            
            // Initial metrics update
            await this.updateMetrics();
            
            logService.info('PerformanceMonitorService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize PerformanceMonitorService:', error);
            throw error;
        }
    }

    startMonitoring() {
        if (this.intervalId) return;
        
        this.intervalId = setInterval(async () => {
            await this.updateMetrics();
        }, this.updateInterval);
    }

    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async updateMetrics() {
        try {
            // Update memory metrics
            if (performance.memory) {
                this.metrics.memory = {
                    heapUsed: performance.memory.usedJSHeapSize / (1024 * 1024), // MB
                    heapTotal: performance.memory.totalJSHeapSize / (1024 * 1024) // MB
                };
            }

            // Update system metrics (simulated for demo)
            this.metrics.system = {
                memory: Math.round(Math.random() * 100),
                cpu: Math.round(Math.random() * 100),
                fps: 60 - Math.round(Math.random() * 10)
            };

            // Notify listeners
            this.notifyListeners();
        } catch (error) {
            logService.error('Failed to update metrics:', error);
        }
    }

    addListener(callback) {
        if (typeof callback === 'function') {
            this.listeners.add(callback);
        }
    }

    removeListener(callback) {
        this.listeners.delete(callback);
    }

    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.metrics);
            } catch (error) {
                logService.error('Error in performance monitor listener:', error);
            }
        });
    }

    getAllMetrics() {
        return this.metrics;
    }

    destroy() {
        this.stopMonitoring();
        this.listeners.clear();
    }
}

// Create and export singleton instance
const performanceMonitorService = new PerformanceMonitorService();
export { performanceMonitorService }; 