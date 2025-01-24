import { BaseManager } from '../../services/core/BaseManager.js';
import { LogManager } from '../../services/core/LogManager.js';
import { ErrorType, ErrorSeverity } from '../../services/core/ErrorTypes.js';

class TestManager extends BaseManager {
    async onInitialize() {
        return true;
    }

    async onDispose() {
        return true;
    }
}

describe('BaseManager', () => {
    let manager;
    let loggerMock;

    beforeEach(() => {
        // Mock LogManager
        loggerMock = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
            success: jest.fn()
        };

        jest.spyOn(LogManager, 'getInstance').mockReturnValue({
            getLogger: () => loggerMock
        });

        manager = new TestManager();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        test('should initialize successfully', async () => {
            const result = await manager.initialize();
            expect(result).toBe(true);
            expect(manager._initialized).toBe(true);
            expect(loggerMock.success).toHaveBeenCalledWith(
                expect.stringContaining('Initialization completed'),
                expect.any(Object)
            );
        });

        test('should not initialize twice', async () => {
            await manager.initialize();
            const result = await manager.initialize();
            expect(result).toBe(true);
            expect(loggerMock.debug).toHaveBeenCalledWith(
                expect.stringContaining('Already initialized'),
                expect.any(Object)
            );
        });

        test('should initialize dependencies before self', async () => {
            const dependency = new TestManager();
            const initSpy = jest.spyOn(dependency, 'initialize');
            manager.addDependency(dependency);

            await manager.initialize();
            expect(initSpy).toHaveBeenCalled();
        });

        test('should fail if dependency initialization fails', async () => {
            const dependency = new TestManager();
            jest.spyOn(dependency, 'onInitialize').mockResolvedValue(false);
            manager.addDependency(dependency);

            const result = await manager.initialize();
            expect(result).toBe(false);
            expect(loggerMock.error).toHaveBeenCalledWith(
                expect.stringContaining('Initialization failed'),
                expect.any(Object)
            );
        });
    });

    describe('dependency management', () => {
        test('should add dependency correctly', () => {
            const dependency = new TestManager();
            manager.addDependency(dependency);
            expect(manager._dependencies.has(dependency)).toBe(true);
        });

        test('should throw error when adding invalid dependency', () => {
            expect(() => {
                manager.addDependency({});
            }).toThrow('Dependency must be a BaseManager instance');
        });
    });

    describe('disposal', () => {
        test('should dispose successfully', async () => {
            await manager.initialize();
            await manager.dispose();
            expect(manager._disposed).toBe(true);
            expect(manager._initialized).toBe(false);
            expect(loggerMock.success).toHaveBeenCalledWith(
                expect.stringContaining('Disposal completed'),
                expect.any(Object)
            );
        });

        test('should not dispose twice', async () => {
            await manager.dispose();
            await manager.dispose();
            expect(loggerMock.debug).toHaveBeenCalledWith(
                expect.stringContaining('Already disposed'),
                expect.any(Object)
            );
        });

        test('should dispose dependencies in reverse order', async () => {
            const dep1 = new TestManager();
            const dep2 = new TestManager();
            const disposeSpy1 = jest.spyOn(dep1, 'dispose');
            const disposeSpy2 = jest.spyOn(dep2, 'dispose');

            manager.addDependency(dep1);
            manager.addDependency(dep2);
            await manager.initialize();
            await manager.dispose();

            expect(disposeSpy2).toHaveBeenCalledBefore(disposeSpy1);
        });
    });

    describe('error handling', () => {
        test('should handle errors with context', () => {
            const error = new Error('Test error');
            const context = { test: 'context' };
            
            manager.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, context);
            
            expect(loggerMock.error).toHaveBeenCalledWith(
                expect.stringContaining('Test error'),
                error,
                expect.objectContaining({
                    type: ErrorType.UNKNOWN,
                    severity: ErrorSeverity.ERROR,
                    test: 'context'
                })
            );
        });

        test('should handle errors without context', () => {
            const error = new Error('Test error');
            
            manager.handleError(error);
            
            expect(loggerMock.error).toHaveBeenCalledWith(
                expect.stringContaining('Test error'),
                error,
                expect.objectContaining({
                    type: ErrorType.UNKNOWN,
                    severity: ErrorSeverity.ERROR
                })
            );
        });
    });

    describe('logging', () => {
        test('should log with enhanced context', () => {
            const context = { test: 'context' };
            manager.log('INFO', 'Test message', context);
            
            expect(loggerMock.log).toHaveBeenCalledWith(
                'INFO',
                'Test message',
                expect.objectContaining({
                    test: 'context',
                    manager: 'TestManager',
                    initialized: false,
                    dependenciesCount: 0
                })
            );
        });

        test('should log without context', () => {
            manager.log('INFO', 'Test message');
            
            expect(loggerMock.log).toHaveBeenCalledWith(
                'INFO',
                'Test message',
                expect.objectContaining({
                    manager: 'TestManager',
                    initialized: false,
                    dependenciesCount: 0
                })
            );
        });
    });
}); 