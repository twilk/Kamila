import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { DEBUG_CONFIG } from '../../config/debug.js';

/**
 * Manager for debug functionality
 */
class DebugManager extends BaseManager {
    static #instance = null;
    static _registry = null;
    #debugPanel = null;
    #debugEnabled = false;
    #logHistory = [];
    #startTime = 0;
    #settings;
    #setupDebugListeners;
    #initializePanelControls;
    #panelConfig = {
        id: 'debug-panel',
        class: 'debug-panel',
        position: 'bottom-right'
    };
    #MAX_LOG_HISTORY = 100;

    constructor(registry) {
        if (DebugManager.#instance) {
            return DebugManager.#instance;
        }
        super(registry, 'DebugManager');
        DebugManager.#instance = this;
        DebugManager._registry = registry;
    }

    static getInstance() {
        if (!DebugManager.#instance && DebugManager._registry) {
            DebugManager.#instance = new DebugManager(DebugManager._registry);
        }
        return DebugManager.#instance;
    }

    static setRegistry(registry) {
        DebugManager._registry = registry;
    }

    /**
     * Initialize the debug manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing debug manager...');
            
            // Load debug settings
            const storage = await this.getDependency('storage');
            const settings = await storage.get(DEBUG_CONFIG.STORAGE_KEY) || {};
            this.#settings = { ...DEBUG_CONFIG.DEFAULT_SETTINGS, ...settings };
            
            // Set up debug listeners
            if (this.#settings.enabled) {
                this.#setupDebugListeners();
            }
            
            this.log(LogLevel.SUCCESS, '✅ Debug manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Ensure debug panel exists in the DOM
     * @returns {Promise<void>}
     */
    async #ensureDebugPanelExists() {
        this.log(LogLevel.DEBUG, '🔍 Checking for existing debug panel');
        
        let panel = document.getElementById(this.#panelConfig.id);
        if (!panel) {
            panel = await this.#createDebugPanel();
        }

        this.#debugPanel = panel;
        this.#initializePanelStyles();
        this.#initializePanelControls();
    }

    /**
     * Create debug panel in the DOM
     * @returns {Promise<HTMLElement>}
     */
    async #createDebugPanel() {
        const panel = document.createElement('div');
        panel.id = this.#panelConfig.id;
        panel.className = this.#panelConfig.class;
        
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
    #initializePanelStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .debug-panel {
                position: fixed;
                ${this.#panelConfig.position === 'bottom-right' ? 'right: 20px; bottom: 20px;' : ''}
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
}

export const debugManager = DebugManager.getInstance();
export { DebugManager };