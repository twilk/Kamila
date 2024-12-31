import { performanceMonitorService } from '../services/PerformanceMonitorService.js';
import { logService } from '../services/LogService.js';

/**
 * Komponent HUD do wyświetlania metryk wydajności
 */
export class PerformanceHUD {
    constructor() {
        this.container = null;
        this.metrics = {};
        this.isVisible = false;
        logService.info('PerformanceHUD component constructed');
    }

    async initialize() {
        try {
            logService.info('Initializing PerformanceHUD component...');
            this.container = document.getElementById('performance-hud');
            this.setupEventListeners();
            logService.info('PerformanceHUD component initialized');
        } catch (error) {
            logService.error('Failed to initialize PerformanceHUD component', error);
            throw error;
        }
    }

    renderMetrics() {
        if (!this.container || !this.isVisible) return;

        try {
            logService.debug('Rendering performance metrics');
            const html = this.generateMetricsHTML();
            this.container.innerHTML = html;
        } catch (error) {
            logService.error('Failed to render performance metrics', error);
            this.showError('Failed to render metrics');
        }
    }

    showError(message) {
        logService.error('Showing error message:', message);
        if (this.container) {
            this.container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>${message}</span>
                </div>
            `;
        }
    }

    destroy() {
        try {
            logService.info('Destroying PerformanceHUD component...');
            this.removeEventListeners();
            this.container = null;
            logService.info('PerformanceHUD component destroyed');
        } catch (error) {
            logService.error('Failed to destroy PerformanceHUD component', error);
        }
    }
}

// Create and export singleton instance
const performanceHUD = new PerformanceHUD();
export { performanceHUD }; 