module.exports = {
    testEnvironment: 'jsdom',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1'
    },
    setupFiles: ['<rootDir>/tests/setup.js'],
    collectCoverage: true,
    collectCoverageFrom: [
        'services/**/*.js',
        'utils/**/*.js',
        'components/**/*.js',
        'config/**/*.js',
        '!popup.js'
    ]
}; 