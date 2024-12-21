/**
 * Performance Handler for Background Service
 * Manages performance metrics and violations reporting
 */

class PerformanceHandler {
    constructor() {
        this.violations = new Map();
        this.metrics = new Map();
        this.alertThreshold = 3; // Number of violations before alerting
        this.cleanupInterval = 30 * 60 * 1000; // 30 minutes

        this.initializeStorage();
        this.setupCleanupInterval();
    }

    /**
     * Initialize storage for performance data
     */
    async initializeStorage() {
        const stored = await chrome.storage.local.get(['performanceMetrics', 'performanceViolations']);
        if (stored.performanceMetrics) {
            this.metrics = new Map(Object.entries(stored.performanceMetrics));
        }
        if (stored.performanceViolations) {
            this.violations = new Map(Object.entries(stored.performanceViolations));
        }
    }

    /**
     * Handle incoming performance metric
     */
    handleMetric(metric) {
        const { category, name, value, timestamp } = metric;
        const key = `${category}:${name}`;

        if (!this.metrics.has(key)) {
            this.metrics.set(key, []);
        }

        const metrics = this.metrics.get(key);
        metrics.push({ value, timestamp });

        // Keep only last 100 measurements
        if (metrics.length > 100) {
            metrics.shift();
        }

        this.persistMetrics();
    }

    /**
     * Handle performance violation
     */
    handleViolation(violation) {
        const { metric, value, threshold, timestamp } = violation;
        
        if (!this.violations.has(metric)) {
            this.violations.set(metric, []);
        }

        const violations = this.violations.get(metric);
        violations.push({ value, threshold, timestamp });

        // Check if we need to alert
        if (violations.length >= this.alertThreshold) {
            this.sendAlert(metric, violations);
            // Reset after alert
            violations.length = 0;
        }

        this.persistViolations();
    }

    /**
     * Send performance alert
     */
    async sendAlert(metric, violations) {
        const notification = {
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Performance Alert',
            message: `${metric} exceeded threshold ${violations.length} times in the last period`
        };

        await chrome.notifications.create(`perf_alert_${Date.now()}`, notification);

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.warn('Performance Alert:', { metric, violations });
        }
    }

    /**
     * Persist metrics to storage
     */
    async persistMetrics() {
        try {
            await chrome.storage.local.set({
                performanceMetrics: Object.fromEntries(this.metrics)
            });
        } catch (error) {
            console.error('Failed to persist metrics:', error);
        }
    }

    /**
     * Persist violations to storage
     */
    async persistViolations() {
        try {
            await chrome.storage.local.set({
                performanceViolations: Object.fromEntries(this.violations)
            });
        } catch (error) {
            console.error('Failed to persist violations:', error);
        }
    }

    /**
     * Setup cleanup interval
     */
    setupCleanupInterval() {
        setInterval(() => {
            const cutoff = Date.now() - this.cleanupInterval;
            
            // Cleanup old metrics
            for (const [key, metrics] of this.metrics) {
                this.metrics.set(key, 
                    metrics.filter(m => m.timestamp > cutoff)
                );
            }

            // Cleanup old violations
            for (const [key, violations] of this.violations) {
                this.violations.set(key,
                    violations.filter(v => v.timestamp > cutoff)
                );
            }

            this.persistMetrics();
            this.persistViolations();
        }, this.cleanupInterval);
    }

    /**
     * Get performance report
     */
    getReport() {
        return {
            metrics: Object.fromEntries(this.metrics),
            violations: Object.fromEntries(this.violations),
            summary: this.generateSummary()
        };
    }

    /**
     * Generate performance summary
     */
    generateSummary() {
        const summary = {
            totalViolations: 0,
            criticalMetrics: {},
            recentIssues: []
        };

        // Calculate violations
        for (const [metric, violations] of this.violations) {
            summary.totalViolations += violations.length;
            if (violations.length > 0) {
                summary.recentIssues.push({
                    metric,
                    count: violations.length,
                    lastViolation: violations[violations.length - 1]
                });
            }
        }

        // Calculate critical metrics
        for (const [key, metrics] of this.metrics) {
            const recent = metrics.slice(-10);
            if (recent.length > 0) {
                const avg = recent.reduce((a, b) => a + b.value, 0) / recent.length;
                summary.criticalMetrics[key] = avg;
            }
        }

        return summary;
    }
}

export const performanceHandler = new PerformanceHandler(); 