import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';

/**
 * Manager for debug functionality
 */
export class DebugManager extends BaseManager {
    constructor(uiManager) {
        super();
        this.uiManager = uiManager;
        this.isDebugEnabled = false;
        this.logs = [];
        this.maxLogs = 1000;
        this._boundAdjustWindowHeight = this.adjustWindowHeight.bind(this);
    }

    /**
     * Initialize debug functionality
     */
    async _doInitialize() {
        try {
            // Load debug state from storage
            const result = await chrome.storage.local.get('debugMode');
            this.isDebugEnabled = result.debugMode || false;
            
            // Wait for DOM to be ready
            if (document.readyState !== 'complete') {
                await new Promise(resolve => {
                    window.addEventListener('load', resolve, { once: true });
                });
            }

            // Update UI state
            this.updateDebugState();
            
            // Initialize debug panel and switch
            await this.initializeDebugPanel();
            await this.initializeDebugSwitch();

            // Add resize observer for window height adjustments
            this.setupResizeObserver();

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.ERROR);
            return false;
        }
    }

    /**
     * Update debug state in UI
     */
    updateDebugState() {
        const debugClass = this.isDebugEnabled ? 'debug-enabled' : 'debug-disabled';
        document.documentElement.setAttribute('data-debug', debugClass);
    }

    /**
     * Setup resize observer
     */
    setupResizeObserver() {
        if ('ResizeObserver' in window) {
            const debugPanel = document.querySelector('.debug-panel');
            if (debugPanel) {
                const observer = new ResizeObserver(this._boundAdjustWindowHeight);
                observer.observe(debugPanel);
            }
        }
    }

    /**
     * Initialize debug panel
     */
    async initializeDebugPanel() {
        const debugPanel = document.querySelector('.debug-panel');
        if (!debugPanel) return;

        const clearLogsBtn = document.getElementById('clear-logs');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => this.clearLogs());
        }
    }

    /**
     * Initialize debug switch
     */
    async initializeDebugSwitch() {
        const debugSwitch = document.getElementById('debug-switch');
        if (!debugSwitch) return;

        debugSwitch.checked = this.isDebugEnabled;
        
        debugSwitch.addEventListener('change', async (e) => {
            this.isDebugEnabled = e.target.checked;
            this.updateDebugState();
            await chrome.storage.local.set({ debugMode: this.isDebugEnabled });
            
            this.logToPanel(
                this.isDebugEnabled ? 'Debug mode enabled' : 'Debug mode disabled',
                this.isDebugEnabled ? 'success' : 'info'
            );
            
            requestAnimationFrame(() => this.adjustWindowHeight());
        });
    }

    /**
     * Log a message to the debug panel
     * @param {string} message 
     * @param {string} level 
     * @param {*} data 
     */
    logToPanel(message, level = 'info', data = null) {
        const debugLogs = document.getElementById('debug-logs');
        if (!debugLogs) return;

        // Format timestamp
        const now = new Date();
        const timestamp = [
            now.getHours().toString().padStart(2, '0'),
            now.getMinutes().toString().padStart(2, '0'),
            now.getSeconds().toString().padStart(2, '0')
        ].join(':');

        // Format message
        let logMessage = message;
        if (data) {
            if (typeof data === 'string') {
                logMessage += `: ${data}`;
            } else if (data instanceof Error) {
                logMessage += `: ${data.message}`;
            } else if (typeof data === 'object') {
                logMessage += `: ${JSON.stringify(data)}`;
            }
        }

        // Create log entry
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${level}`;
        logEntry.innerHTML = `[${timestamp}] ${logMessage}`;
        
        // Add to panel
        debugLogs.appendChild(logEntry);
        debugLogs.scrollTop = debugLogs.scrollHeight;

        // Store log
        this.logs.push({
            timestamp: now.toISOString(),
            level,
            message: logMessage,
            data
        });

        // Trim logs if needed
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
    }

    /**
     * Clear debug logs
     */
    clearLogs() {
        const debugLogs = document.getElementById('debug-logs');
        if (debugLogs) {
            debugLogs.innerHTML = '';
            this.logToPanel('Logs cleared', 'success');
        }
        this.logs = [];
    }

    /**
     * Adjust window height based on debug panel
     */
    adjustWindowHeight() {
        const debugPanel = document.querySelector('.debug-panel');
        if (!debugPanel) return;

        const debugPanelHeight = debugPanel.offsetHeight;
        const windowHeight = window.innerHeight;
        
        requestAnimationFrame(() => {
            document.documentElement.style.setProperty(
                '--debug-panel-offset',
                `${this.isDebugEnabled ? debugPanelHeight/2 : 0}px`
            );
        });
    }

    /**
     * Get debug logs
     */
    getLogs() {
        return [...this.logs];
    }

    /**
     * Dispose debug functionality
     */
    async _doDispose() {
        this.clearLogs();
        document.documentElement.removeAttribute('data-debug');
        document.documentElement.style.removeProperty('--debug-panel-offset');
    }
} 