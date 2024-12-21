/**
 * Klasa do optymalizacji animacji na podstawie metryk wydajności
 */
import { AnimationMonitor } from './animation.monitor.js';
import { OptimizationMonitor } from './optimization.monitor.js';
import { OPTIMIZATION_THRESHOLDS } from '../config/optimization.thresholds.js';

export class AnimationOptimizer {
    constructor() {
        this.optimizationStrategies = new Map([
            ['transform', this.optimizeTransforms],
            ['opacity', this.optimizeOpacity],
            ['composite', this.optimizeCompositing]
        ]);
        this.optimizationMonitor = new OptimizationMonitor();
        this.thresholds = OPTIMIZATION_THRESHOLDS;
    }

    /**
     * Optymalizuje animację na podstawie metryk
     * @param {HTMLElement} element - Element do optymalizacji
     * @param {Object} metrics - Metryki wydajności
     */
    optimizeAnimation(element, metrics) {
        if (!element || !metrics) return;

        // Ustaw bazowe metryki przed optymalizacją
        this.optimizationMonitor.setBaseline(metrics);

        // Wybierz strategie optymalizacji na podstawie metryk
        if (metrics.performanceScore < this.thresholds.optimization.triggers.heavy) {
            this.applyHeavyOptimizations(element);
            // Monitoruj wpływ ciężkich optymalizacji
            this.monitorOptimizationImpact('heavy', element);
        } else if (metrics.performanceScore < this.thresholds.optimization.triggers.light) {
            this.applyLightOptimizations(element);
            // Monitoruj wpływ lekkich optymalizacji
            this.monitorOptimizationImpact('light', element);
        }

        // Monitoruj wykorzystanie GPU
        this.monitorGPUUsage(element);
    }

    /**
     * Stosuje pełną optymalizację dla słabszej wydajności
     */
    applyHeavyOptimizations(element) {
        // Wymuś akcelerację GPU
        element.style.transform = 'translateZ(0)';
        element.style.backfaceVisibility = 'hidden';
        
        // Zoptymalizuj warstwę kompozycji
        element.style.willChange = 'transform, opacity';
        
        // Redukuj złożoność renderowania
        element.classList.add('optimize-paint');
    }

    /**
     * Stosuje lekką optymalizację dla lepszej wydajności
     */
    applyLightOptimizations(element) {
        // Włącz tylko podstawową akcelerację
        element.style.willChange = 'transform';
        
        // Optymalizuj tylko krytyczne właściwości
        element.classList.add('optimize-minimal');
    }

    /**
     * Monitoruje wykorzystanie GPU i dostosowuje optymalizacje
     */
    monitorGPUUsage(element) {
        if (!window.requestIdleCallback) return;

        requestIdleCallback(() => {
            // Sprawdź czy element nadal potrzebuje optymalizacji
            if (!element.classList.contains('show')) {
                // Wyczyść optymalizacje gdy nie są potrzebne
                element.style.willChange = 'auto';
                element.classList.remove('optimize-paint', 'optimize-minimal');
            }
        });
    }

    /**
     * Optymalizuje transformacje
     */
    optimizeTransforms(element) {
        // Użyj transform zamiast left/top
        element.style.transform = 'translate3d(0,0,0)';
        element.style.transformStyle = 'preserve-3d';
    }

    /**
     * Optymalizuje przezroczystość
     */
    optimizeOpacity(element) {
        // Optymalizuj zmiany przezroczystości
        element.style.opacity = '0.99'; // Wymusza nową warstwę
        requestAnimationFrame(() => {
            element.style.opacity = '1';
        });
    }

    /**
     * Optymalizuje kompozycję warstw
     */
    optimizeCompositing(element) {
        // Zoptymalizuj kompozycję warstw
        element.style.isolation = 'isolate';
        element.style.zIndex = '1';
    }

    async monitorOptimizationImpact(type, element) {
        const animationMonitor = new AnimationMonitor();
        animationMonitor.startMonitoring();

        // Poczekaj na zakończenie animacji
        await new Promise(resolve => setTimeout(resolve, 300));

        const metrics = animationMonitor.stopMonitoring();
        this.optimizationMonitor.registerOptimizationMetrics(type, metrics);

        // Dostosuj optymalizacje na podstawie wpływu
        const report = this.optimizationMonitor.getOptimizationReport();
        this.adjustOptimizations(element, report);
    }

    adjustOptimizations(element, report) {
        const impact = report.optimizations;

        // Sprawdź czy optymalizacje przynoszą wystarczającą poprawę
        if (impact.heavy?.impact) {
            const { minimumImpact } = this.thresholds.optimization;
            const heavyImpact = impact.heavy.impact;

            if (heavyImpact.fpsImprovement < minimumImpact.fps ||
                heavyImpact.frameTimeReduction < minimumImpact.frameTime ||
                heavyImpact.jankReduction < minimumImpact.jank ||
                heavyImpact.scoreImprovement < minimumImpact.score) {
                element.style.willChange = 'auto';
                element.classList.remove('optimize-paint');
                console.debug('Removing heavy optimizations due to insufficient impact');
            }
        }
    }
} 