/**
 * Logger for tracking initialization progress and performance
 */
export class InitLogger {
    constructor() {
        this.logs = [];
        this.startTimes = new Map();
        this.metrics = new Map();
    }

    /**
     * Start tracking initialization of a component
     * @param {string} componentName 
     */
    startInit(componentName) {
        const timestamp = performance.now();
        this.startTimes.set(componentName, timestamp);
        this.log(componentName, 'start', 'Initialization started');
    }

    /**
     * End tracking initialization of a component
     * @param {string} componentName 
     * @param {boolean} success 
     * @param {string} [message] 
     */
    endInit(componentName, success, message = '') {
        const endTime = performance.now();
        const startTime = this.startTimes.get(componentName);
        
        if (startTime) {
            const duration = endTime - startTime;
            this.metrics.set(componentName, {
                duration,
                success,
                timestamp: new Date().toISOString()
            });
            
            this.log(componentName, success ? 'success' : 'error', 
                message || `Initialization ${success ? 'completed' : 'failed'} in ${duration.toFixed(2)}ms`);
            
            this.startTimes.delete(componentName);
        }
    }

    /**
     * Log a message
     * @param {string} componentName 
     * @param {string} type 
     * @param {string} message 
     */
    log(componentName, type, message) {
        const entry = {
            timestamp: new Date().toISOString(),
            component: componentName,
            type,
            message
        };
        
        this.logs.push(entry);
        
        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            const prefix = `[${entry.timestamp}] [${componentName}] [${type}]`;
            switch (type) {
                case 'error':
                    console.error(prefix, message);
                    break;
                case 'warning':
                    console.warn(prefix, message);
                    break;
                default:
                    console.log(prefix, message);
            }
        }
    }

    /**
     * Get initialization metrics
     * @returns {Object}
     */
    getMetrics() {
        const result = {
            totalTime: 0,
            successCount: 0,
            errorCount: 0,
            components: {}
        };

        this.metrics.forEach((data, component) => {
            result.components[component] = data;
            result.totalTime += data.duration;
            if (data.success) {
                result.successCount++;
            } else {
                result.errorCount++;
            }
        });

        return result;
    }

    /**
     * Get initialization logs
     * @returns {Array}
     */
    getLogs() {
        return this.logs;
    }

    /**
     * Clear all logs and metrics
     */
    clear() {
        this.logs = [];
        this.startTimes.clear();
        this.metrics.clear();
    }
} 