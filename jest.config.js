module.exports = {
    testEnvironment: 'jsdom',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1'
    },
    setupFiles: ['<rootDir>/tests/setup.js'],
    collectCoverage: true,
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/popup/popup.js'  // Wykluczamy główny plik popup.js z testów jednostkowych
    ],
    testMatch: [
        '**/tests/unit/**/*.test.js',
        '**/tests/integration/**/*.test.js'
    ],
    setupFilesAfterEnv: [
        '<rootDir>/tests/setup.js'
    ],
    globals: {
        REQUEST_LIMITS: {
            rateLimit: {
                perSecond: 10,
                perMinute: 300,
                perHour: 10000
            },
            priority: {
                CRITICAL: 4,
                HIGH: 3,
                MEDIUM: 2,
                LOW: 1
            }
        }
    }
}; 