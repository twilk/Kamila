import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';

/**
 * Manager for debug functionality
 */
export class DebugManager extends BaseManager {
    static _instance = null;

    static getInstance() {
        if (!DebugManager._instance) {
            DebugManager._instance = new DebugManager();
        }
        return DebugManager._instance;
    }

    constructor() {
        if (DebugManager._instance) {
            throw new Error('DebugManager is a singleton. Use DebugManager.getInstance() instead.');
        }
        super('DebugManager');
        this._errorHandler = null;
        this.debugPanel = null;
        this.debugEnabled = false;
        this.logHistory = [];
        this.MAX_LOG_HISTORY = 100;
        this._panelConfig = {
            id: 'debug-panel',
            class: 'debug-panel',
            position: 'bottom-right'
        };
        DebugManager._instance = this;
    }

    /**
     * Initialize the debug manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            this._startTime = performance.now();
            this.log(LogLevel.INFO, '🚀 Starting debug manager initialization');

            // Initialize debug manager
            this.log(LogLevel.INFO, '🔧 Starting debug manager initialization');

            // Ensure debug panel exists
            this.log(LogLevel.INFO, '🎯 Ensuring debug panel exists');
            await this.ensureDebugPanelExists();
            this.log(LogLevel.SUCCESS, '✅ Debug panel ready');

            // Load debug state
            this.log(LogLevel.INFO, '💾 Loading debug state');
            await this.loadDebugState();
            this.log(LogLevel.SUCCESS, '✅ Debug state loaded');

            // Initialize debug switch
            this.log(LogLevel.INFO, '🔄 Initializing debug switch');
            await this.initializeDebugSwitch();

            const duration = (performance.now() - this._startTime).toFixed(2);
            this.log(LogLevel.SUCCESS, '✅ Debug manager initialized', {
                debugEnabled: this.debugEnabled,
                hasDebugPanel: !!this.debugPanel,
                duration: `${duration}ms`
            });

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                context: 'Debug manager initialization failed'
            });
            return false;
        }
    }

    /**
     * Ensure debug panel exists in the DOM
     * @returns {Promise<void>}
     */
    async ensureDebugPanelExists() {
        this.log(LogLevel.DEBUG, '🔍 Checking for existing debug panel');
        
        let panel = document.getElementById(this._panelConfig.id);
        if (!panel) {
            panel = await this.createDebugPanel();
        }

        this.debugPanel = panel;
        this.initializePanelStyles();
        this.initializePanelControls();
    }

    /**
     * Create debug panel in the DOM
     * @returns {Promise<HTMLElement>}
     */
    async createDebugPanel() {
        const panel = document.createElement('div');
        panel.id = this._panelConfig.id;
        panel.className = this._panelConfig.class;
        
        // Create panel structure
        panel.innerHTML = `
            <div class="debug-panel-header">
                <h3>Debug Panel</h3>
                <div class="debug-panel-controls">
                    <button id="clear-logs" title="Clear logs">🗑️</button>
                </div>
            </div>
            <div class="debug-panel-content">
                <div class="debug-log-container"></div>
            </div>
        `;

        document.body.appendChild(panel);
        return panel;
    }

    /**
     * Initialize panel styles
     */
    initializePanelStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .debug-panel {
                position: fixed;
                ${this._panelConfig.position === 'bottom-right' ? 'right: 20px; bottom: 20px;' : ''}
                width: 300px;
                max-height: 400px;
                background: rgba(0, 0, 0, 0.8);
                color: #fff;
                border-radius: 8px;
                font-family: monospace;
                z-index: 9999;
                overflow: hidden;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            }
            .debug-panel-header {
                padding: 8px;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .debug-panel-header h3 {
                margin: 0;
                font-size: 14px;
            }
            .debug-panel-controls {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            .debug-panel-controls button {
                background: none;
                border: none;
                color: #fff;
                cursor: pointer;
                padding: 4px;
                opacity: 0.7;
                transition: opacity 0.2s;
            }
            .debug-panel-controls button:hover {
                opacity: 1;
            }
            .debug-panel-content {
                padding: 8px;
                max-height: 350px;
                overflow-y: auto;
            }
            .debug-log-container {
                font-size: 12px;
                line-height: 1.4;
            }
            .debug-log {
                margin: 4px 0;
                padding: 4px;
                border-radius: 4px;
                background: rgba(255, 255, 255, 0.1);
            }
            .debug-log.error { color: #ff4444; }
            .debug-log.warn { color: #ffbb33; }
            .debug-log.info { color: #33b5e5; }
            .debug-log.success { color: #00C851; }
        `;
        document.head.appendChild(style);
    }

    /**
     * Initialize panel controls
     */
    initializePanelControls() {
        const clearBtn = this.debugPanel.querySelector('#clear-logs');
        const toggleBtn = this.debugPanel.querySelector('#toggle-debug');

        clearBtn?.addEventListener('click', () => this.clearLogs());
        toggleBtn?.addEventListener('click', () => this.toggleDebug());
    }

    /**
     * Load debug state from storage
     */
    async loadDebugState() {
        this.log(LogLevel.DEBUG, '🔍 Loading debug state from storage');
        try {
            const state = await chrome.storage.local.get('debugEnabled');
            this.debugEnabled = state.debugEnabled || false;
            this.log(LogLevel.INFO, '🔄 Updating UI with debug state', { debugEnabled: this.debugEnabled });
            this.updateDebugUI();
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                context: 'Failed to load debug state'
            });
            this.debugEnabled = false;
        }
    }

    /**
     * Update debug UI based on current state
     */
    updateDebugUI() {
        // Update debug panel visibility
        if (this.debugPanel) {
            this.debugPanel.style.display = this.debugEnabled ? 'block' : 'none';
        }

        // Update debug button state
        const debugButton = document.getElementById('debug-button');
        if (debugButton) {
            debugButton.classList.toggle('active', this.debugEnabled);
        }
    }

    /**
     * Toggle debug mode
     */
    async toggleDebug() {
        this.debugEnabled = !this.debugEnabled;
        try {
            await chrome.storage.local.set({ debugEnabled: this.debugEnabled });
            this.log(LogLevel.INFO, `🔄 Debug mode ${this.debugEnabled ? 'enabled' : 'disabled'}`);
            this.updateDebugUI();
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                context: 'Failed to save debug state'
            });
        }
    }

    /**
     * Log message to debug panel
     */
    logToPanel(message, level = LogLevel.INFO, data = null) {
        if (!this.debugEnabled || !this.debugPanel) return;

        const logContainer = this.debugPanel.querySelector('.debug-log-container');
        if (!logContainer) return;

        const logEntry = document.createElement('div');
        logEntry.className = `debug-log ${level.toLowerCase()}`;
        
        const timestamp = new Date().toISOString();
        const dataString = data ? `\n${JSON.stringify(data, null, 2)}` : '';
        
        logEntry.textContent = `[${timestamp}] ${message}${dataString}`;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;

        // Maintain log history
        this.logHistory.push({ timestamp, level, message, data });
        if (this.logHistory.length > this.MAX_LOG_HISTORY) {
            this.logHistory.shift();
        }
    }

    /**
     * Clear all logs
     */
    clearLogs() {
        if (!this.debugPanel) return;

        const logContainer = this.debugPanel.querySelector('.debug-log-container');
        if (logContainer) {
            logContainer.innerHTML = '';
        }
        this.logHistory = [];
        this.log(LogLevel.INFO, '🗑️ Logs cleared');
    }

    /**
     * Dispose debug manager
     */
    async dispose() {
        try {
            this.log(LogLevel.INFO, '🗑️ Disposing debug manager');
            
            if (this.debugPanel && this.debugPanel.parentNode) {
                this.debugPanel.parentNode.removeChild(this.debugPanel);
            }
            
            this.debugPanel = null;
            this.logHistory = [];
            
            await super.dispose();
            this.log(LogLevel.SUCCESS, '✅ Debug manager disposed');
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.MEDIUM, {
                context: 'Failed to dispose debug manager'
            });
        }
    }

    async initializeDebugSwitch() {
        try {
            const debugButton = document.getElementById('debug-button');
            if (!debugButton) {
                this.log(LogLevel.WARN, '⚠️ Debug button element not found, skipping initialization');
                return false;
            }
            
            // Initialize debug button state
            debugButton.classList.toggle('active', this.debugEnabled);
            
            // Add click handler
            debugButton.addEventListener('click', () => {
                this.toggleDebug();
                debugButton.classList.toggle('active', this.debugEnabled);
            });

            // Add styles for active state if not exists
            if (!document.querySelector('style[data-id="debug-button-styles"]')) {
                const style = document.createElement('style');
                style.setAttribute('data-id', 'debug-button-styles');
                style.textContent = `
                    .BugButton {
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 8px;
                        border-radius: 8px;
                        transition: background-color 0.3s ease;
                    }
                    .BugButton:hover {
                        background: rgba(207, 207, 207, 0.1);
                    }
                    .BugButton.active {
                        background: rgba(51, 181, 229, 0.2);
                    }
                    .BugButton.active .bugsvg path {
                        stroke: #33b5e5;
                    }
                `;
                document.head.appendChild(style);
            }
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                context: 'Failed to initialize debug button'
            });
            return false;
        }
    }
}

// Export singleton instance
export const debugManager = DebugManager.getInstance(); 