import '@testing-library/jest-dom';

// Mock fetch globally
global.fetch = jest.fn();

// Mock chrome API
global.chrome = {
    runtime: {
        getURL: jest.fn(path => `chrome-extension://mock-id/${path}`),
        sendMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn()
        }
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    }
};

// Mock console methods
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
};

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn(),
    removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock URL
global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();

// Mock dla window.bootstrap
global.bootstrap = {
    Modal: class {
        constructor() {}
        show() {}
        hide() {}
    },
    Tab: class {
        constructor() {}
        show() {}
    },
    Tooltip: class {
        constructor() {}
        show() {}
        hide() {}
    }
}; 