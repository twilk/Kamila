import { performanceMonitorService } from '../services/PerformanceMonitorService.js';
import { logService } from '../services/LogService.js';

/**
 * Komponent HUD do wyświetlania informacji debugowych
 */
export class HUD {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.metrics = null;
        this.initialized = false;
        logService.info('HUD component constructed');
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            logService.info('Initializing HUD component...');
            await performanceMonitorService.initialize();
            performanceMonitorService.addListener(this.updateMetrics.bind(this));
            this.initialized = true;
            logService.info('HUD component initialized');
        } catch (error) {
            logService.error('Failed to initialize HUD component', error);
            throw error;
        }
    }

    updateMetrics(metrics) {
        this.metrics = metrics;
        this.render();
    }

    render() {
        if (!this.metrics) {
            return;
        }

        try {
            logService.debug('Rendering HUD metrics');
            const { network, cache, system } = this.metrics;

            this.container.innerHTML = `
                <div class="debug-hud">
                    <div class="debug-hud__section">
                        <h3>Debug Info</h3>
                        <p>Memory: ${system.memory}MB</p>
                        <p>FPS: ${system.fps}</p>
                        <p>Cache Hit Rate: ${cache.efficiency}%</p>
                        <p>Network Errors: ${network.errors}</p>
            </div>
                </div>
            `;
        } catch (error) {
            logService.error('Failed to render HUD metrics', error);
            this.showError('Failed to render HUD metrics');
        }
    }

    showError(message) {
        logService.error('Showing error message:', message);
        this.container.innerHTML = `
            <div class="alert alert-danger">
                ${message}
            </div>
        `;
    }

    destroy() {
        try {
            logService.info('Destroying HUD component...');
            performanceMonitorService.removeListener(this.updateMetrics.bind(this));
            this.container.innerHTML = '';
            this.initialized = false;
            logService.info('HUD component destroyed');
        } catch (error) {
            logService.error('Failed to destroy HUD component', error);
            throw error;
        }
    }
}

// Create and export singleton instance
const hud = new HUD('debug-hud');
export { hud }; 