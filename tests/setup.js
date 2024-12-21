import '@testing-library/jest-dom';

// Mock Chrome Extension API
global.chrome = {
    runtime: {
        sendMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn()
        },
        getManifest: () => ({
            version: '1.2.0'
        }),
        getURL: jest.fn(path => `chrome-extension://mock-extension-id/${path}`)
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    },
    i18n: {
        getMessage: jest.fn()
    }
};

// Mock fetch API
global.fetch = jest.fn();

// Mock localStorage
global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};

// Mock window.matchMedia
global.matchMedia = jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn()
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = callback => setTimeout(callback, 0);
global.cancelAnimationFrame = jest.fn();

// Mock Performance API
global.performance = {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn()
};

// Mock i18n
global.i18n = {
    translate: jest.fn(key => key),
    initialized: true,
    translations: {
        debugPanel: {
            info: 'ℹ️',
            error: '❌',
            success: '✅',
            warning: '⚠️'
        }
    }
};

// Mock AccessibilityService
global.accessibilityService = {
    announce: jest.fn(),
    createFocusTrap: jest.fn(),
    checkColorContrast: jest.fn()
};

// Mock ThemeManager
global.ThemeManager = {
    instance: null,
    getInstance: jest.fn()
};

// Cleanup after each test
afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
    i18n.translate.mockClear();
});

// Scentralizuj wszystkie wspólne mocki
global.setupMocks = () => {
    // Mock i18n
    global.i18n = {
        translate: jest.fn(key => key),
        initialized: true,
        translations: {
            debugPanel: {
                info: 'ℹ️',
                error: '❌',
                success: '✅',
                warning: '⚠️'
            }
        }
    };

    // Mock AccessibilityService
    global.accessibilityService = {
        announce: jest.fn(),
        createFocusTrap: jest.fn(),
        checkColorContrast: jest.fn()
    };

    // Mock ThemeManager
    global.ThemeManager = {
        instance: null,
        getInstance: jest.fn()
    };
};