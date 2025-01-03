import { performanceMonitorService } from '../services/PerformanceMonitorService.js';
import { logService } from '../services/LogService.js';
import { apiService } from '../services/ApiService.js';

/**
 * Komponent HUD do wyświetlania informacji debugowych w stylu cyberpunk
 */
export class HUD {
    constructor() {
        this.container = null;
        this.scouterButton = null;
        this.metrics = null;
        this.apiStats = null;
        this.initialized = false;
        this.visible = false;
        logService.info('HUD component constructed');
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            logService.info('Initializing HUD component...');
            
            // Initialize performance monitor and API stats
            await performanceMonitorService.initialize();
            
            // Get DOM elements when they should be available
            this.container = document.getElementById('performance-hud');
            this.scouterButton = document.getElementById('scouter-button');
            
            if (!this.container || !this.scouterButton) {
                throw new Error('Required DOM elements not found');
            }
            
            // Setup scouter button click handler
            this.scouterButton.addEventListener('click', () => this.toggleVisibility());
            
            // Add performance monitor listener
            performanceMonitorService.addListener((metrics) => this.updateMetrics(metrics));
            
            // Add API stats listener
            apiService.addStatsListener((stats) => this.updateApiStats(stats));
            
            this.initialized = true;
            logService.info('HUD component initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize HUD component:', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    updateMetrics(metrics) {
        this.metrics = metrics;
        if (this.visible) {
            this.render();
        }
    }

    updateApiStats(stats) {
        this.apiStats = stats;
        if (this.visible) {
            this.render();
        }
    }

    toggleVisibility() {
        if (!this.container) return;
        
        this.visible = !this.visible;
        if (this.visible) {
            this.container.classList.remove('hidden');
            this.render();
        } else {
            this.container.classList.add('hidden');
        }
        
        // Animate scouter button
        if (this.scouterButton) {
            this.scouterButton.style.transform = this.visible ? 'rotate(180deg)' : 'none';
        }
    }

    render() {
        if (!this.container) return;

        try {
            const { memory, system } = this.metrics || {};
            const apiStats = this.apiStats || {};
            
            this.container.innerHTML = `
                <div class="hud-section">
                    <div class="hud-section-header">
                        <span class="hud-section-title">API Monitor</span>
                        <span class="hud-section-timer">${new Date().toLocaleTimeString()}</span>
                    </div>
                    <div class="hud-metric">
                        <span class="hud-metric-label">Calls:</span>
                        <span class="hud-metric-value">✓${apiStats.successCalls || 0} ❌${apiStats.errorCalls || 0}</span>
                    </div>
                    <div class="hud-metric">
                        <span class="hud-metric-label">Response:</span>
                        <span class="hud-metric-value">${apiStats.responseTimeMs ? Math.round(apiStats.responseTimeMs) + 'ms' : '-'}</span>
                        <div class="hud-progress">
                            <div class="hud-progress-bar" style="width: ${Math.min(100, (apiStats.responseTimeMs || 0) / 10)}%"></div>
                        </div>
                    </div>
                    ${apiStats.lastCallTime ? `
                        <div class="hud-metric">
                            <span class="hud-metric-label">Last Call:</span>
                            <span class="hud-metric-value">${new Date(apiStats.lastCallTime).toLocaleTimeString()}</span>
                        </div>
                    ` : ''}
                </div>

                ${system ? `
                    <div class="hud-section">
                        <div class="hud-section-header">
                            <span class="hud-section-title">System</span>
                        </div>
                        <div class="hud-metric">
                            <span class="hud-metric-label">Memory:</span>
                            <span class="hud-metric-value">${Math.round(system.memory)}%</span>
                            <div class="hud-progress">
                                <div class="hud-progress-bar" style="width: ${system.memory}%"></div>
                            </div>
                        </div>
                        <div class="hud-metric">
                            <span class="hud-metric-label">CPU:</span>
                            <span class="hud-metric-value">${system.cpu}%</span>
                            <div class="hud-progress">
                                <div class="hud-progress-bar" style="width: ${system.cpu}%"></div>
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${memory ? `
                    <div class="hud-section">
                        <div class="hud-section-header">
                            <span class="hud-section-title">Memory</span>
                        </div>
                        <div class="hud-metric">
                            <span class="hud-metric-label">Heap:</span>
                            <span class="hud-metric-value">${Math.round(memory.heapUsed)}/${Math.round(memory.heapTotal)} MB</span>
                            <div class="hud-progress">
                                <div class="hud-progress-bar" style="width: ${(memory.heapUsed / memory.heapTotal) * 100}%"></div>
                            </div>
                        </div>
                    </div>
                ` : ''}
            `;
        } catch (error) {
            logService.error('Failed to render HUD', error);
            this.showError('Failed to render HUD');
        }
    }

    showError(message) {
        if (!this.container) return;
        
        logService.error('Showing error message:', message);
        this.container.innerHTML = `
            <div class="hud-section">
                <div class="hud-section-header">
                    <span class="hud-section-title">Error</span>
                </div>
                <div class="hud-metric hud-status-error">
                    ${message}
                </div>
            </div>
        `;
    }

    destroy() {
        try {
            logService.info('Destroying HUD component...');
            performanceMonitorService.removeListener(this.updateMetrics.bind(this));
            apiService.removeStatsListener(this.updateApiStats.bind(this));
            if (this.container) {
                this.container.innerHTML = '';
            }
            if (this.scouterButton) {
                this.scouterButton.removeEventListener('click', this.toggleVisibility);
            }
            this.initialized = false;
            this.visible = false;
            this.apiStats = null;
            logService.info('HUD component destroyed');
        } catch (error) {
            logService.error('Failed to destroy HUD component', error);
            throw error;
        }
    }
}

// Create and export singleton instance
const hud = new HUD();
export { hud }; 