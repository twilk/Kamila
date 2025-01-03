import { logService } from './LogService.js';
import { cacheManagerService } from './CacheManagerService.js';

const METRICS_CONFIG = {
    maxSamples: 100,
    metricsKey: 'endpoint_metrics',
    aggregationPeriod: 60 * 1000, // 1 minuta
    thresholds: {
        responseTime: 2000, // 2 sekundy
        errorRate: 0.1, // 10%
        timeoutRate: 0.05 // 5%
    }
};

class EndpointMetric {
    constructor(url) {
        this.url = url;
        this.samples = [];
        this.lastAggregation = Date.now();
        this.aggregatedStats = {
            avgResponseTime: 0,
            errorRate: 0,
            timeoutRate: 0,
            availability: 1,
            successCount: 0,
            errorCount: 0,
            timeoutCount: 0,
            totalRequests: 0
        };
    }

    addSample(sample) {
        this.samples.push({
            timestamp: Date.now(),
            ...sample
        });

        // Zachowaj tylko ostatnie N próbek
        if (this.samples.length > METRICS_CONFIG.maxSamples) {
            this.samples.shift();
        }

        this.checkAggregation();
    }

    checkAggregation() {
        const now = Date.now();
        if (now - this.lastAggregation >= METRICS_CONFIG.aggregationPeriod) {
            this.aggregate();
        }
    }

    aggregate() {
        const now = Date.now();
        const periodSamples = this.samples.filter(
            sample => now - sample.timestamp <= METRICS_CONFIG.aggregationPeriod
        );

        if (periodSamples.length === 0) return;

        const stats = {
            successCount: 0,
            errorCount: 0,
            timeoutCount: 0,
            totalResponseTime: 0
        };

        periodSamples.forEach(sample => {
            if (sample.timeout) stats.timeoutCount++;
            else if (sample.error) stats.errorCount++;
            else {
                stats.successCount++;
                stats.totalResponseTime += sample.responseTime;
            }
        });

        const totalRequests = periodSamples.length;

        this.aggregatedStats = {
            avgResponseTime: stats.successCount ? stats.totalResponseTime / stats.successCount : 0,
            errorRate: stats.errorCount / totalRequests,
            timeoutRate: stats.timeoutCount / totalRequests,
            availability: stats.successCount / totalRequests,
            successCount: stats.successCount,
            errorCount: stats.errorCount,
            timeoutCount: stats.timeoutCount,
            totalRequests
        };

        this.lastAggregation = now;
    }

    getHealth() {
        this.checkAggregation();

        const issues = [];
        const stats = this.aggregatedStats;

        if (stats.avgResponseTime > METRICS_CONFIG.thresholds.responseTime) {
            issues.push({
                type: 'high_latency',
                value: stats.avgResponseTime,
                threshold: METRICS_CONFIG.thresholds.responseTime
            });
        }

        if (stats.errorRate > METRICS_CONFIG.thresholds.errorRate) {
            issues.push({
                type: 'high_error_rate',
                value: stats.errorRate,
                threshold: METRICS_CONFIG.thresholds.errorRate
            });
        }

        if (stats.timeoutRate > METRICS_CONFIG.thresholds.timeoutRate) {
            issues.push({
                type: 'high_timeout_rate',
                value: stats.timeoutRate,
                threshold: METRICS_CONFIG.thresholds.timeoutRate
            });
        }

        return {
            isHealthy: issues.length === 0,
            issues,
            stats: this.aggregatedStats
        };
    }
}

export class EndpointMetricsService {
    constructor() {
        this.initialized = false;
        this.metrics = new Map();
        logService.info('EndpointMetricsService constructed');
    }

    async initialize() {
        if (this.initialized) return;

        try {
            logService.info('Initializing EndpointMetricsService...');
            await this.loadMetrics();
            this.initialized = true;
            logService.info('EndpointMetricsService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize EndpointMetricsService', error);
            throw error;
        }
    }

    async loadMetrics() {
        try {
            const savedMetrics = await cacheManagerService.get(METRICS_CONFIG.metricsKey) || {};
            
            Object.entries(savedMetrics).forEach(([url, data]) => {
                const metric = new EndpointMetric(url);
                metric.samples = data.samples || [];
                metric.aggregatedStats = data.aggregatedStats || {};
                metric.lastAggregation = data.lastAggregation || Date.now();
                this.metrics.set(url, metric);
            });

            logService.debug('Metrics loaded', { 
                endpointCount: this.metrics.size 
            });
        } catch (error) {
            logService.error('Failed to load metrics', error);
            this.metrics = new Map();
        }
    }

    async saveMetrics() {
        try {
            const metricsData = {};
            this.metrics.forEach((metric, url) => {
                metricsData[url] = {
                    samples: metric.samples,
                    aggregatedStats: metric.aggregatedStats,
                    lastAggregation: metric.lastAggregation
                };
            });

            await cacheManagerService.set(METRICS_CONFIG.metricsKey, metricsData);
            logService.debug('Metrics saved successfully');
        } catch (error) {
            logService.error('Failed to save metrics', error);
        }
    }

    recordRequest(url, options = {}) {
        const startTime = Date.now();
        let metric = this.metrics.get(url);
        
        if (!metric) {
            metric = new EndpointMetric(url);
            this.metrics.set(url, metric);
        }

        return {
            success: (responseTime = Date.now() - startTime) => {
                metric.addSample({ responseTime, error: false, timeout: false });
                this.saveMetrics();
            },
            error: (isTimeout = false) => {
                metric.addSample({
                    responseTime: Date.now() - startTime,
                    error: !isTimeout,
                    timeout: isTimeout
                });
                this.saveMetrics();
            }
        };
    }

    getEndpointHealth(url) {
        const metric = this.metrics.get(url);
        if (!metric) {
            return {
                isHealthy: true,
                issues: [],
                stats: null
            };
        }
        return metric.getHealth();
    }

    getAllMetrics() {
        const allMetrics = {};
        this.metrics.forEach((metric, url) => {
            allMetrics[url] = metric.getHealth();
        });
        return allMetrics;
    }

    cleanup() {
        logService.debug('Cleaning up EndpointMetricsService...');
        this.saveMetrics();
        this.metrics.clear();
        this.initialized = false;
        logService.debug('EndpointMetricsService cleaned up successfully');
    }
}

export const endpointMetricsService = new EndpointMetricsService(); 