import { i18n } from '../../services/i18n.js';

export class DebugManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
    }

    async verifyDebugPassword() {
        const password = prompt(i18n.translate('debugPasswordPrompt'), '');
        return password === 'tango';
    }

    async checkDebugAccess() {
        const debugEnabled = document.body.classList.contains('debug-enabled');
        if (!debugEnabled) {
            if (await this.verifyDebugPassword()) {
                document.body.classList.add('debug-enabled');
                const debugSwitch = document.getElementById('debug-switch');
                if (debugSwitch) {
                    debugSwitch.checked = true;
                }
                await chrome.storage.local.set({ debugMode: true });
                logToPanel(i18n.translate('debugEnabled'), 'success');
                return true;
            } else {
                alert(i18n.translate('debugPasswordIncorrect'));
                return false;
            }
        }
        return true;
    }

    initializeDebugSwitch() {
        const debugSwitch = document.getElementById('debug-switch');
        if (!debugSwitch) return;
        
        debugSwitch.checked = false;
        document.body.classList.remove('debug-enabled');
        chrome.storage.local.set({ debugMode: false });
        
        debugSwitch.addEventListener('change', async (e) => {
            if (e.target.checked) {
                if (!await this.checkDebugAccess()) {
                    e.target.checked = false;
                }
            } else {
                document.body.classList.remove('debug-enabled');
                await chrome.storage.local.set({ debugMode: false });
                logToPanel(i18n.translate('debugDisabled'), 'info');
            }
        });
    }

    logToPanel(message, type = 'info', data = null) {
        const now = new Date();
        const timestamp = [
            now.getHours().toString().padStart(2, '0'),
            now.getMinutes().toString().padStart(2, '0'),
            now.getSeconds().toString().padStart(2, '0')
        ].join(':');

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

        if (i18n.translations && Object.keys(i18n.translations).length > 0) {
            const prefix = i18n.translate(`debugPanel${type.charAt(0).toUpperCase() + type.slice(1)}`);
            logMessage = `${prefix} ${logMessage}`;
        } else {
            logMessage = `[${type.toUpperCase()}] ${logMessage}`;
        }
        
        console.log(`[${timestamp}] ${logMessage}`);
        
        const debugLogs = document.getElementById('debug-logs');
        if (debugLogs) {
            const emptyLog = debugLogs.querySelector('.log-entry.log-empty');
            if (emptyLog) {
                emptyLog.remove();
            }

            const logEntry = document.createElement('div');
            logEntry.className = `log-entry log-${type}`;
            logEntry.innerHTML = `[${timestamp}] ${logMessage}`;
            debugLogs.appendChild(logEntry);
            debugLogs.scrollTop = debugLogs.scrollHeight;
        }
    }

    initializeDebugPanel() {
        document.querySelector('.debug-panel')?.addEventListener('mouseenter', async (e) => {
            if (!document.body.classList.contains('debug-enabled')) {
                if (!await this.checkDebugAccess()) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
        });

        const clearLogsBtn = document.getElementById('clear-logs');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                const debugLogs = document.getElementById('debug-logs');
                if (debugLogs) {
                    debugLogs.innerHTML = '';
                    this.logToPanel('🧹 Logi wyczyszczone', 'success');
                }
            });
        }
    }
} 