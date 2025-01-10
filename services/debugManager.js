import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';
import { i18n } from './i18n.js';

export class DebugManager extends BaseManager {
    constructor(uiManager) {
        super();
        this.uiManager = uiManager;
        this.isDebugEnabled = false;
        this.debugPassword = 'tango'; // TODO: Move to secure config
        this.logs = [];
        this.maxLogs = 1000;
    }

    async initialize() {
        try {
            await super.initialize();
            
            // Initialize debug panel
            await this.initializeDebugPanel();
            
            // Initialize debug switch
            await this.initializeDebugSwitch();
            
            // Load debug state
            const { debugMode } = await chrome.storage.local.get('debugMode');
            if (debugMode) {
                await this.enableDebug(false); // Don't verify password for stored state
            }

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    async initializeDebugPanel() {
        try {
            const debugPanel = document.querySelector('.debug-panel');
            if (!debugPanel) return;

            // Clear logs button
            const clearLogsBtn = document.getElementById('clear-logs');
            if (clearLogsBtn) {
                clearLogsBtn.addEventListener('click', () => this.clearLogs());
            }

            // Initialize empty state
            this.updateDebugPanel();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeDebugPanel'
            });
        }
    }

    async initializeDebugSwitch() {
        try {
            const debugSwitch = document.getElementById('debug-switch');
            if (!debugSwitch) return;

            // Set initial state
            debugSwitch.checked = this.isDebugEnabled;
            document.body.classList.toggle('debug-enabled', this.isDebugEnabled);

            // Add change handler
            debugSwitch.addEventListener('change', async (e) => {
                const shouldEnable = e.target.checked;
                if (shouldEnable) {
                    await this.enableDebug();
                } else {
                    await this.disableDebug();
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeDebugSwitch'
            });
        }
    }

    async enableDebug(verifyPassword = true) {
        try {
            if (verifyPassword && !await this.verifyDebugPassword()) {
                return false;
            }

            this.isDebugEnabled = true;
            document.body.classList.add('debug-enabled');
            
            const debugSwitch = document.getElementById('debug-switch');
            if (debugSwitch) {
                debugSwitch.checked = true;
            }

            await chrome.storage.local.set({ debugMode: true });
            this.logToPanel(i18n.translate('debugEnabled'), 'success');
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'enableDebug'
            });
            return false;
        }
    }

    async disableDebug() {
        try {
            this.isDebugEnabled = false;
            document.body.classList.remove('debug-enabled');
            
            const debugSwitch = document.getElementById('debug-switch');
            if (debugSwitch) {
                debugSwitch.checked = false;
            }

            await chrome.storage.local.set({ debugMode: false });
            this.logToPanel(i18n.translate('debugDisabled'), 'info');
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'disableDebug'
            });
            return false;
        }
    }

    async verifyDebugPassword() {
        const password = prompt(i18n.translate('debugPasswordPrompt'), '');
        return password === this.debugPassword;
    }

    logToPanel(message, type = 'info', data = null) {
        try {
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

            // Add translation prefix
            if (i18n.translations && Object.keys(i18n.translations).length > 0) {
                const prefix = i18n.translate(`debugPanel${type.charAt(0).toUpperCase() + type.slice(1)}`);
                logMessage = `${prefix} ${logMessage}`;
            } else {
                logMessage = `[${type.toUpperCase()}] ${logMessage}`;
            }

            // Create log entry
            const logEntry = {
                timestamp,
                message: logMessage,
                type,
                data
            };

            // Add to logs array
            this.logs.unshift(logEntry);
            if (this.logs.length > this.maxLogs) {
                this.logs.pop();
            }

            // Update UI
            this.updateDebugPanel();

            // Console log
            console.log(`[${timestamp}] ${logMessage}`);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'logToPanel',
                message,
                type,
                data
            });
        }
    }

    updateDebugPanel() {
        try {
            const debugLogs = document.getElementById('debug-logs');
            if (!debugLogs) return;

            // Clear current logs
            debugLogs.innerHTML = '';

            if (this.logs.length === 0) {
                const emptyLog = document.createElement('div');
                emptyLog.className = 'log-entry log-empty';
                emptyLog.textContent = i18n.translate('noLogs');
                debugLogs.appendChild(emptyLog);
                return;
            }

            // Add log entries
            this.logs.forEach(log => {
                const logEntry = document.createElement('div');
                logEntry.className = `log-entry log-${log.type}`;
                logEntry.innerHTML = `[${log.timestamp}] ${log.message}`;
                debugLogs.appendChild(logEntry);
            });

            // Scroll to bottom
            debugLogs.scrollTop = debugLogs.scrollHeight;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateDebugPanel'
            });
        }
    }

    clearLogs() {
        try {
            this.logs = [];
            this.updateDebugPanel();
            this.logToPanel(i18n.translate('logsCleared'), 'success');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'clearLogs'
            });
        }
    }

    dispose() {
        try {
            this.logs = [];
            this.isDebugEnabled = false;
            document.body.classList.remove('debug-enabled');
            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 