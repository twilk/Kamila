/**
 * Klasa do monitorowania wpływu optymalizacji
 */
export class OptimizationMonitor {
    constructor() {
        this.metrics = new Map();
        this.baselineMetrics = null;
        this.optimizationImpact = new Map();
    }

    /**
     * Ustala bazowe metryki przed optymalizacją
     * @param {Object} metrics - Metryki wydajności
     */
    setBaseline(metrics) {
        this.baselineMetrics = {
            fps: metrics.averageFps,
            frameTime: metrics.averageFrameTime,
            jank: metrics.jankCount,
            performanceScore: metrics.performanceScore
        };
    }

    /**
     * Rejestruje metryki po optymalizacji
     * @param {string} optimizationType - Typ optymalizacji
     * @param {Object} metrics - Metryki wydajności
     */
    registerOptimizationMetrics(optimizationType, metrics) {
        this.metrics.set(optimizationType, {
            fps: metrics.averageFps,
            frameTime: metrics.averageFrameTime,
            jank: metrics.jankCount,
            performanceScore: metrics.performanceScore
        });

        this.calculateImpact(optimizationType);
    }

    /**
     * Oblicza wpływ optymalizacji
     * @param {string} optimizationType - Typ optymalizacji
     */
    calculateImpact(optimizationType) {
        if (!this.baselineMetrics) return;

        const optimizedMetrics = this.metrics.get(optimizationType);
        const impact = {
            fpsImprovement: (optimizedMetrics.fps - this.baselineMetrics.fps) / this.baselineMetrics.fps * 100,
            frameTimeReduction: (this.baselineMetrics.frameTime - optimizedMetrics.frameTime) / this.baselineMetrics.frameTime * 100,
            jankReduction: (this.baselineMetrics.jank - optimizedMetrics.jank) / this.baselineMetrics.jank * 100,
            scoreImprovement: (optimizedMetrics.performanceScore - this.baselineMetrics.performanceScore) / this.baselineMetrics.performanceScore * 100
        };

        this.optimizationImpact.set(optimizationType, impact);
        this.logImpact(optimizationType, impact);
    }

    /**
     * Loguje wpływ optymalizacji
     * @param {string} type - Typ optymalizacji
     * @param {Object} impact - Wpływ optymalizacji
     */
    logImpact(type, impact) {
        console.debug(`Optimization Impact (${type}):`, {
            'FPS Improvement': `${impact.fpsImprovement.toFixed(2)}%`,
            'Frame Time Reduction': `${impact.frameTimeReduction.toFixed(2)}%`,
            'Jank Reduction': `${impact.jankReduction.toFixed(2)}%`,
            'Performance Score Improvement': `${impact.scoreImprovement.toFixed(2)}%`
        });
    }

    /**
     * Zwraca raport z wpływu optymalizacji
     */
    getOptimizationReport() {
        const report = {
            baseline: this.baselineMetrics,
            optimizations: {}
        };

        for (const [type, impact] of this.optimizationImpact) {
            report.optimizations[type] = {
                metrics: this.metrics.get(type),
                impact: impact
            };
        }

        return report;
    }
} 