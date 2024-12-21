/**
 * Performance Debug Panel Component
 * Displays real-time performance metrics and violations
 */

class PerformancePanel {
    constructor() {
        this.container = null;
        this.updateInterval = 1000; // 1 second refresh
        this.intervalId = null;
    }

    /**
     * Initialize the panel
     */
    init() {
        this.container = document.createElement('div');
        this.container.className = 'performance-panel';
        this.container.innerHTML = `
            <div class="performance-panel__header">
                <h3>Performance Monitor</h3>
                <button class="btn-close" aria-label="Close"></button>
            </div>
            <div class="performance-panel__content">
                <div class="metrics-container"></div>
                <div class="violations-container"></div>
            </div>
            <div class="performance-panel__footer">
                <button class="btn btn-sm btn-outline-secondary" data-action="clear">
                    Clear Metrics
                </button>
                <button class="btn btn-sm btn-primary" data-action="export">
                    Export Report
                </button>
            </div>
        `;

        this.setupEventListeners();
        this.startUpdates();
        
        return this.container;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.container.querySelector('.btn-close').addEventListener('click', 
            () => this.hide());

        this.container.querySelector('[data-action="clear"]').addEventListener('click', 
            () => this.clearMetrics());

        this.container.querySelector('[data-action="export"]').addEventListener('click', 
            () => this.exportReport());
    }

    /**
     * Start periodic updates
     */
    startUpdates() {
        this.updateMetrics();
        this.intervalId = setInterval(() => this.updateMetrics(), this.updateInterval);
    }

    /**
     * Update metrics display
     */
    async updateMetrics() {
        const report = await this.getPerformanceReport();
        this.renderMetrics(report.metrics);
        this.renderViolations(report.violations);
        this.updateSummary(report.summary);
    }

    /**
     * Render metrics section
     */
    renderMetrics(metrics) {
        const container = this.container.querySelector('.metrics-container');
        container.innerHTML = Object.entries(metrics)
            .map(([category, values]) => `
                <div class="metric-group">
                    <h4>${category}</h4>
                    ${this.formatMetricValues(values)}
                </div>
            `).join('');
    }

    /**
     * Render violations section
     */
    renderViolations(violations) {
        const container = this.container.querySelector('.violations-container');
        container.innerHTML = `
            <h4>Performance Violations</h4>
            <div class="violations-list">
                ${Object.entries(violations)
                    .map(([metric, items]) => `
                        <div class="violation-item ${items.length > 0 ? 'has-violations' : ''}">
                            <span>${metric}</span>
                            <span>${items.length}</span>
                        </div>
                    `).join('')}
            </div>
        `;
    }

    /**
     * Get performance report from background
     */
    async getPerformanceReport() {
        return new Promise(resolve => {
            chrome.runtime.sendMessage(
                { type: 'GET_PERFORMANCE_REPORT' },
                response => resolve(response)
            );
        });
    }

    /**
     * Clear all metrics
     */
    async clearMetrics() {
        await chrome.runtime.sendMessage({ type: 'CLEAR_PERFORMANCE_METRICS' });
        this.updateMetrics();
    }

    /**
     * Export performance report
     */
    async exportReport() {
        const report = await this.getPerformanceReport();
        const blob = new Blob(
            [JSON.stringify(report, null, 2)], 
            { type: 'application/json' }
        );
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-report-${new Date().toISOString()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    show() {
        this.container.classList.add('show');
        this.startUpdates();
    }

    hide() {
        this.container.classList.remove('show');
        clearInterval(this.intervalId);
    }

    destroy() {
        clearInterval(this.intervalId);
        this.container.remove();
    }
}

export const performancePanel = new PerformancePanel(); 