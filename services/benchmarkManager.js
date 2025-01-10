export class BenchmarkManager {
    constructor() {
        this.measurements = new Map();
        this.startTimes = new Map();
    }

    start(componentName) {
        this.startTimes.set(componentName, performance.now());
    }

    end(componentName) {
        const startTime = this.startTimes.get(componentName);
        if (startTime) {
            const duration = performance.now() - startTime;
            this.measurements.set(componentName, duration);
            this.startTimes.delete(componentName);
            console.debug(`[Benchmark] ${componentName}: ${duration.toFixed(2)}ms`);
        }
    }

    getReport() {
        return Array.from(this.measurements.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name, duration]) => ({
                component: name,
                duration: duration.toFixed(2),
                timestamp: new Date().toISOString()
            }));
    }
} 