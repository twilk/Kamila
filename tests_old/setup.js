import '@testing-library/jest-dom';

// Mock chrome API
global.chrome = {
    runtime: {
        onMessage: {
            addListener: jest.fn()
        },
        sendMessage: jest.fn()
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    }
};

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn(),
    removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch
global.fetch = jest.fn();

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