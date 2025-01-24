import { LogManager } from '../../services/core/LogManager.js';
import { BaseManager } from '../../services/core/BaseManager.js';
import { StoreManager } from '../../services/storeManager.js';
import { UIManager } from '../../services/core/UIManager.js';
import { DataManager } from '../../services/dataManager.js';
import { CacheManager } from '../../services/core/CacheManager.js';

describe('Manager Integration', () => {
    let logManager;
    let storeManager;
    let uiManager;
    let dataManager;
    let cacheManager;

    beforeEach(() => {
        // Reset all singleton instances
        LogManager._instance = null;
        StoreManager._instance = null;
        UIManager._instance = null;
        DataManager._instance = null;
        CacheManager._instance = null;

        // Initialize managers
        logManager = LogManager.getInstance();
        storeManager = StoreManager.getInstance();
        uiManager = UIManager.getInstance();
        dataManager = DataManager.getInstance();
        cacheManager = CacheManager.getInstance();

        // Mock console methods
        global.console = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn()
        };

        // Mock chrome.storage.local
        global.chrome = {
            storage: {
                local: {
                    get: jest.fn(),
                    set: jest.fn(),
                    remove: jest.fn()
                }
            }
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Initialization Chain', () => {
        test('should initialize managers in correct order', async () => {
            // Add dependencies
            dataManager.addDependency(cacheManager);
            dataManager.addDependency(storeManager);
            uiManager.addDependency(dataManager);

            // Initialize UI manager (should trigger dependency chain)
            const result = await uiManager.initialize();
            expect(result).toBe(true);

            // Verify initialization order through logs
            const logs = logManager.getHistory();
            const initLogs = logs.filter(log => 
                log.message.includes('Initialization completed')
            );

            expect(initLogs).toHaveLength(4);
            expect(initLogs[0].context.manager).toBe('CacheManager');
            expect(initLogs[1].context.manager).toBe('StoreManager');
            expect(initLogs[2].context.manager).toBe('DataManager');
            expect(initLogs[3].context.manager).toBe('UIManager');
        });

        test('should handle initialization failure gracefully', async () => {
            // Mock CacheManager initialization to fail
            jest.spyOn(cacheManager, 'onInitialize').mockResolvedValue(false);

            dataManager.addDependency(cacheManager);
            uiManager.addDependency(dataManager);

            const result = await uiManager.initialize();
            expect(result).toBe(false);

            // Verify error logs
            const logs = logManager.getHistory();
            const errorLogs = logs.filter(log => 
                log.level === 'ERROR' && 
                log.message.includes('Initialization failed')
            );
            expect(errorLogs).toHaveLength(1);
        });
    });

    describe('Store Change Flow', () => {
        beforeEach(async () => {
            // Initialize all required managers
            await cacheManager.initialize();
            await storeManager.initialize();
            await dataManager.initialize();
            await uiManager.initialize();
        });

        test('should handle store change across managers', async () => {
            // Mock store data
            const newStore = {
                id: 'STORE1',
                name: 'Test Store',
                address: 'Test Address'
            };

            // Change store
            const result = await storeManager.changeStore('STORE1');
            expect(result).toBe(true);

            // Verify logs across managers
            const logs = logManager.getHistory();
            
            // StoreManager should log store change
            expect(logs.some(log => 
                log.message.includes('Store changed') &&
                log.context.manager === 'StoreManager'
            )).toBe(true);

            // CacheManager should log cache clearing
            expect(logs.some(log => 
                log.message.includes('Cleared cache') &&
                log.context.manager === 'CacheManager'
            )).toBe(true);

            // DataManager should log data refresh
            expect(logs.some(log => 
                log.message.includes('Refreshing data') &&
                log.context.manager === 'DataManager'
            )).toBe(true);

            // UIManager should log UI update
            expect(logs.some(log => 
                log.message.includes('Store UI updated') &&
                log.context.manager === 'UIManager'
            )).toBe(true);
        });

        test('should handle store change failure gracefully', async () => {
            // Mock storage error
            global.chrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

            const result = await storeManager.changeStore('STORE1');
            expect(result).toBe(false);

            // Verify error handling across managers
            const logs = logManager.getHistory();
            const errorLogs = logs.filter(log => log.level === 'ERROR');
            
            // Should have error logs from affected managers
            expect(errorLogs.length).toBeGreaterThan(0);
            expect(errorLogs[0].context.type).toBe('STORE');
            expect(errorLogs[0].context.severity).toBe('ERROR');
        });
    });

    describe('Error Propagation', () => {
        test('should propagate errors through manager chain', async () => {
            // Add dependencies
            dataManager.addDependency(cacheManager);
            uiManager.addDependency(dataManager);

            // Mock error in cache operation
            jest.spyOn(cacheManager, 'get').mockRejectedValue(new Error('Cache error'));

            // Trigger operation that uses cache
            await dataManager.fetchData('test-endpoint');

            // Verify error handling chain
            const logs = logManager.getHistory();
            const errorLogs = logs.filter(log => log.level === 'ERROR');

            // Should have error logs from both managers
            expect(errorLogs).toHaveLength(2);
            expect(errorLogs[0].context.manager).toBe('CacheManager');
            expect(errorLogs[1].context.manager).toBe('DataManager');
        });
    });

    describe('Disposal Chain', () => {
        test('should dispose managers in reverse initialization order', async () => {
            // Set up dependencies
            dataManager.addDependency(cacheManager);
            dataManager.addDependency(storeManager);
            uiManager.addDependency(dataManager);

            // Initialize all managers
            await uiManager.initialize();

            // Dispose UI manager (should trigger dependency chain)
            await uiManager.dispose();

            // Verify disposal order through logs
            const logs = logManager.getHistory();
            const disposalLogs = logs.filter(log => 
                log.message.includes('Disposal completed')
            );

            expect(disposalLogs).toHaveLength(4);
            expect(disposalLogs[0].context.manager).toBe('UIManager');
            expect(disposalLogs[1].context.manager).toBe('DataManager');
            expect(disposalLogs[2].context.manager).toBe('StoreManager');
            expect(disposalLogs[3].context.manager).toBe('CacheManager');
        });
    });
}); 