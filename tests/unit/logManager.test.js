import { LogManager } from '../../services/core/LogManager.js';
import { BaseLogger } from '../../services/core/BaseLogger.js';

describe('LogManager', () => {
    let logManager;

    beforeEach(() => {
        // Clear singleton instance before each test
        LogManager._instance = null;
        logManager = LogManager.getInstance();
    });

    describe('singleton pattern', () => {
        test('should create only one instance', () => {
            const instance1 = LogManager.getInstance();
            const instance2 = LogManager.getInstance();
            expect(instance1).toBe(instance2);
        });

        test('should throw error when trying to create new instance directly', () => {
            expect(() => new LogManager()).toThrow('Use LogManager.getInstance()');
        });
    });

    describe('logger management', () => {
        test('should return a BaseLogger instance', () => {
            const logger = logManager.getLogger();
            expect(logger).toBeInstanceOf(BaseLogger);
        });

        test('should return the same logger instance on multiple calls', () => {
            const logger1 = logManager.getLogger();
            const logger2 = logManager.getLogger();
            expect(logger1).toBe(logger2);
        });
    });

    describe('log history', () => {
        beforeEach(() => {
            // Mock console methods
            global.console = {
                log: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
                info: jest.fn(),
                debug: jest.fn()
            };
        });

        test('should store logs in history', () => {
            const logger = logManager.getLogger();
            logger.info('Test message');
            const history = logManager.getHistory();
            expect(history).toHaveLength(1);
            expect(history[0]).toMatchObject({
                level: 'INFO',
                message: expect.stringContaining('Test message')
            });
        });

        test('should limit history size', () => {
            const logger = logManager.getLogger();
            for (let i = 0; i < 1100; i++) {
                logger.info(`Message ${i}`);
            }
            const history = logManager.getHistory();
            expect(history.length).toBeLessThanOrEqual(1000);
        });

        test('should clear history', () => {
            const logger = logManager.getLogger();
            logger.info('Test message');
            logManager.clearHistory();
            expect(logManager.getHistory()).toHaveLength(0);
        });

        test('should export logs correctly', () => {
            const logger = logManager.getLogger();
            logger.info('Test message 1');
            logger.error('Test error', new Error('Test'));
            logger.warn('Test warning');

            const exported = logManager.exportLogs();
            expect(exported).toBeInstanceOf(Array);
            expect(exported).toHaveLength(3);
            expect(exported[0]).toMatchObject({
                level: 'INFO',
                message: expect.stringContaining('Test message 1')
            });
        });
    });

    describe('error handling', () => {
        test('should handle circular references in context', () => {
            const logger = logManager.getLogger();
            const circular = {};
            circular.self = circular;
            
            expect(() => {
                logger.info('Test message', circular);
            }).not.toThrow();
        });

        test('should handle undefined logger gracefully', () => {
            LogManager._instance = null;
            expect(() => {
                LogManager.getInstance().getLogger().info('Test');
            }).not.toThrow();
        });
    });
}); 