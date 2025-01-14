describe('Debug Panel Tests', () => {
    let debugPanel, debugLogs, debugSwitch;
    
    function simulateMessage(message, type = 'info', data = null) {
        // Symuluj otrzymanie wiadomości
        const event = new CustomEvent('message', {
            detail: {
                type: 'LOG_MESSAGE',
                payload: { message, type, data }
            }
        });
        window.dispatchEvent(event);
    }
    
    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div class="debug-panel">
                <div class="debug-header">
                    <span>Panel debugowania</span>
                    <button id="clear-logs">Wyczyść</button>
                </div>
                <div class="debug-content">
                    <div id="debug-logs"></div>
                </div>
            </div>
            <input type="checkbox" id="debug-switch">
        `;
        
        debugPanel = document.querySelector('.debug-panel');
        debugLogs = document.getElementById('debug-logs');
        debugSwitch = document.getElementById('debug-switch');
        
        // Reset localStorage
        localStorage.clear();
        
        // Mock chrome.runtime.sendMessage
        global.chrome = {
            runtime: {
                sendMessage: jest.fn(),
                onMessage: {
                    addListener: jest.fn((callback) => {
                        // Dodaj listener dla symulowanych wiadomości
                        window.addEventListener('message', (event) => {
                            callback(event.detail);
                        });
                    })
                }
            }
        };
    });

    test('should initialize debug panel correctly', () => {
        initDebugMode();
        expect(debugPanel).toBeTruthy();
        expect(debugLogs).toBeTruthy();
        expect(debugSwitch).toBeTruthy();
    });

    test('should handle log messages correctly', () => {
        // Enable debug mode
        localStorage.setItem('debugMode', 'true');
        initDebugMode();

        // Simulate message
        chrome.runtime.onMessage.dispatch({
            type: 'LOG_MESSAGE',
            payload: {
                message: 'Test message',
                type: 'info',
                data: null
            }
        });

        // Check if log was added
        const logEntries = debugLogs.querySelectorAll('.log-entry');
        expect(logEntries.length).toBe(1);
        expect(logEntries[0].textContent).toContain('Test message');
    });

    test('should clear logs correctly', () => {
        localStorage.setItem('debugMode', 'true');
        initDebugMode();

        // Add some logs
        ['Log 1', 'Log 2', 'Log 3'].forEach(msg => {
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            logEntry.textContent = msg;
            debugLogs.appendChild(logEntry);
        });

        // Clear logs
        document.getElementById('clear-logs').click();

        // Check if only empty log message remains
        const logEntries = debugLogs.querySelectorAll('.log-entry');
        expect(logEntries.length).toBe(1);
        expect(logEntries[0].classList.contains('log-empty')).toBe(true);
    });

    test('should add log entry directly to panel', () => {
        localStorage.setItem('debugMode', 'true');
        initDebugMode();
        
        addLogToPanel('Test direct log', 'info', null);
        
        const logEntries = debugLogs.querySelectorAll('.log-entry:not(.log-empty)');
        expect(logEntries.length).toBe(1);
        expect(logEntries[0].textContent).toContain('Test direct log');
    });

    test('should handle multiple log entries', () => {
        localStorage.setItem('debugMode', 'true');
        initDebugMode();
        
        const testLogs = [
            { message: 'Log 1', type: 'info' },
            { message: 'Log 2', type: 'success' },
            { message: 'Log 3', type: 'error' }
        ];
        
        testLogs.forEach(log => {
            addLogToPanel(log.message, log.type);
        });
        
        const logEntries = debugLogs.querySelectorAll('.log-entry:not(.log-empty)');
        expect(logEntries.length).toBe(testLogs.length);
        logEntries.forEach((entry, index) => {
            expect(entry.textContent).toContain(testLogs[index].message);
            expect(entry.classList.contains(`log-${testLogs[index].type}`)).toBe(true);
        });
    });

    test('should show debug panel when enabled', () => {
        localStorage.setItem('debugMode', 'true');
        initDebugMode();
        
        expect(debugPanel.style.display).toBe('flex');
        expect(window.getComputedStyle(debugPanel).display).not.toBe('none');
        
        // Sprawdź czy panel jest w DOM i widoczny
        expect(document.body.contains(debugPanel)).toBe(true);
        expect(debugPanel.offsetParent).not.toBe(null);
    });

    test('should properly handle message events', () => {
        localStorage.setItem('debugMode', 'true');
        initDebugMode();
        
        simulateMessage('Test message');
        
        // Poczekaj na następną ramkę animacji
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                const logEntries = debugLogs.querySelectorAll('.log-entry:not(.log-empty)');
                expect(logEntries.length).toBe(1);
                expect(logEntries[0].textContent).toContain('Test message');
                resolve();
            });
        });
    });
}); 