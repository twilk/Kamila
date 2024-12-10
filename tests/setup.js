// Mock dla chrome API
global.chrome = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    },
    runtime: {
        onMessage: {
            addListener: jest.fn()
        },
        sendMessage: jest.fn()
    },
    action: {
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn()
    }
};

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