import { BaseLogger } from '../../services/core/BaseLogger.js';

describe('BaseLogger', () => {
    let logger;

    beforeEach(() => {
        logger = new BaseLogger();
        // Mock console methods
        global.console = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn()
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('log levels', () => {
        test('should log error messages correctly', () => {
            const error = new Error('Test error');
            logger.error('Error message', error);
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('❌'),
                expect.stringContaining('Error message'),
                expect.objectContaining({ error })
            );
        });

        test('should log warning messages correctly', () => {
            logger.warn('Warning message');
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('⚠️'),
                expect.stringContaining('Warning message')
            );
        });

        test('should log info messages correctly', () => {
            logger.info('Info message');
            expect(console.info).toHaveBeenCalledWith(
                expect.stringContaining('ℹ️'),
                expect.stringContaining('Info message')
            );
        });

        test('should log debug messages correctly', () => {
            logger.debug('Debug message');
            expect(console.debug).toHaveBeenCalledWith(
                expect.stringContaining('🔍'),
                expect.stringContaining('Debug message')
            );
        });

        test('should log success messages correctly', () => {
            logger.success('Success message');
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('✅'),
                expect.stringContaining('Success message')
            );
        });
    });

    describe('log formatting', () => {
        test('should include timestamp in log messages', () => {
            logger.info('Test message');
            expect(console.info).toHaveBeenCalledWith(
                expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
                expect.any(String)
            );
        });

        test('should include context in log messages', () => {
            const context = { userId: 123, action: 'test' };
            logger.info('Test message', context);
            expect(console.info).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.objectContaining(context)
            );
        });

        test('should handle undefined context', () => {
            logger.info('Test message');
            expect(console.info).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('Test message')
            );
        });
    });

    describe('error handling', () => {
        test('should handle Error objects correctly', () => {
            const error = new Error('Test error');
            logger.error('Error occurred', error);
            expect(console.error).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('Error occurred'),
                expect.objectContaining({
                    error: error,
                    stack: error.stack
                })
            );
        });

        test('should handle non-Error objects in error logging', () => {
            const errorObj = { message: 'Custom error' };
            logger.error('Error occurred', errorObj);
            expect(console.error).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('Error occurred'),
                expect.objectContaining({
                    error: errorObj
                })
            );
        });
    });
}); 