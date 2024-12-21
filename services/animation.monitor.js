/**
 * Klasa do monitorowania wydajności animacji
 */
export class AnimationMonitor {
    constructor() {
        this.metrics = {
            fps: [],
            frameTime: [],
            jank: 0
        };
        this.isMonitoring = false;
        this.lastFrameTime = 0;
        this.frameCount = 0;
    }

    /**
     * Rozpoczyna monitorowanie animacji
     */
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.metrics = {
            fps: [],
            frameTime: [],
            jank: 0
        };
        
        this.monitorFrame();
    }

    /**
     * Monitoruje pojedynczą klatkę animacji
     */
    monitorFrame() {
        if (!this.isMonitoring) return;

        const currentTime = performance.now();
        const frameDelta = currentTime - this.lastFrameTime;
        
        // Oblicz FPS
        const fps = 1000 / frameDelta;
        this.metrics.fps.push(fps);
        
        // Zapisz czas klatki
        this.metrics.frameTime.push(frameDelta);
        
        // Wykryj jank (pominięte klatki)
        if (frameDelta > 16.7) { // 60 FPS = 16.7ms na klatkę
            this.metrics.jank++;
        }
        
        this.lastFrameTime = currentTime;
        this.frameCount++;
        
        requestAnimationFrame(() => this.monitorFrame());
    }

    /**
     * Zatrzymuje monitorowanie i zwraca wyniki
     */
    stopMonitoring() {
        this.isMonitoring = false;
        
        const avgFps = this.metrics.fps.reduce((a, b) => a + b, 0) / this.metrics.fps.length;
        const avgFrameTime = this.metrics.frameTime.reduce((a, b) => a + b, 0) / this.metrics.frameTime.length;
        
        return {
            averageFps: avgFps,
            averageFrameTime: avgFrameTime,
            jankCount: this.metrics.jank,
            totalFrames: this.frameCount,
            performanceScore: this.calculatePerformanceScore(avgFps, this.metrics.jank)
        };
    }

    /**
     * Oblicza wynik wydajności animacji
     */
    calculatePerformanceScore(fps, jank) {
        const fpsScore = Math.min(fps / 60, 1) * 70; // FPS stanowi 70% wyniku
        const jankPenalty = Math.min(jank / 10, 1) * 30; // Jank stanowi 30% wyniku
        
        return Math.max(fpsScore - jankPenalty, 0);
    }
} 