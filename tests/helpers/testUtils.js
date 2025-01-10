/**
 * Test utilities for integration tests
 */

/**
 * Create a mock chrome API
 */
export function setupChromeApi() {
    global.chrome = {
        storage: {
            local: {
                get: jest.fn(),
                set: jest.fn(),
                remove: jest.fn()
            }
        },
        runtime: {
            sendMessage: jest.fn(),
            onMessage: {
                addListener: jest.fn(),
                removeListener: jest.fn()
            },
            getManifest: jest.fn().mockReturnValue({ version: '1.0.0' })
        }
    };
}

/**
 * Create a mock bootstrap API
 */
export function setupBootstrapApi() {
    global.bootstrap = {
        Tooltip: jest.fn().mockImplementation(() => ({
            dispose: jest.fn()
        })),
        Popover: jest.fn().mockImplementation(() => ({
            dispose: jest.fn()
        })),
        Modal: jest.fn().mockImplementation(() => ({
            dispose: jest.fn()
        }))
    };
}

/**
 * Create a mock metrics manager
 */
export function createMockMetricsManager() {
    return {
        trackOperation: jest.fn((name, fn) => fn()),
        trackTiming: jest.fn(),
        getMetrics: jest.fn().mockReturnValue({
            initialization: {
                totalTime: 0,
                componentTimes: new Map(),
                errors: []
            },
            memory: {
                lastCheck: 0,
                usage: []
            },
            performance: {
                operations: new Map(),
                timings: new Map()
            }
        })
    };
}

/**
 * Create a mock DOM structure
 */
export function setupTestDom() {
    document.body.innerHTML = `
        <div id="app">
            <select id="store-select"></select>
            <div data-counter="counter1" class="counter">
                <span class="count">0</span>
            </div>
            <div data-counter="counter2" class="counter">
                <span class="count">0</span>
            </div>
            <button data-bs-toggle="tooltip" title="Test tooltip">Tooltip</button>
            <div data-bs-toggle="popover" title="Test popover">Popover</div>
            <div class="modal">Modal</div>
            <div id="debug-panel" class="d-none">Debug Panel</div>
            <div id="loading-overlay" class="d-none">Loading...</div>
            <div id="error-container" class="d-none">Error</div>
        </div>
    `;
}

/**
 * Clean up test environment
 */
export function cleanupTestEnvironment() {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    jest.restoreAllMocks();
}

/**
 * Create mock storage data
 */
export function createMockStorageData() {
    return {
        selectedStore: 'store1',
        leadCounts: { counter1: 5, counter2: 10 },
        lastUpdate: Date.now(),
        language: 'polish',
        theme: 'light'
    };
}

/**
 * Setup mock storage with data
 * @param {Object} data 
 */
export function setupMockStorage(data = createMockStorageData()) {
    chrome.storage.local.get.mockImplementation((key) => {
        if (typeof key === 'string') {
            return Promise.resolve({ [key]: data[key] });
        }
        if (Array.isArray(key)) {
            const result = {};
            key.forEach(k => {
                if (data[k] !== undefined) {
                    result[k] = data[k];
                }
            });
            return Promise.resolve(result);
        }
        return Promise.resolve(data);
    });
    
    chrome.storage.local.set.mockImplementation(() => Promise.resolve());
    chrome.storage.local.remove.mockImplementation(() => Promise.resolve());
}

/**
 * Wait for all pending promises to resolve
 */
export async function flushPromises() {
    return new Promise(resolve => setImmediate(resolve));
}

/**
 * Create a mock event
 * @param {string} type 
 * @param {Object} detail 
 */
export function createMockEvent(type, detail = {}) {
    return new CustomEvent(type, { detail });
}

/**
 * Mock performance API
 */
export function setupPerformanceApi() {
    if (!window.performance) {
        window.performance = {};
    }
    window.performance.now = jest.fn(() => Date.now());
    window.performance.memory = {
        usedJSHeapSize: 10000000,
        totalJSHeapSize: 20000000,
        jsHeapSizeLimit: 30000000
    };
}

/**
 * Mock console methods
 */
export function setupConsoleMocks() {
    const originalConsole = { ...console };
    global.console = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    };
    return originalConsole;
}

/**
 * Restore console methods
 * @param {Object} originalConsole 
 */
export function restoreConsole(originalConsole) {
    global.console = originalConsole;
} 