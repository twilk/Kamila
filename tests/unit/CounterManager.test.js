import { CounterManager } from '../../services/core/CounterManager.js';
import { CacheManager } from '../../services/core/CacheManager.js';
import { ErrorHandler } from '../../services/core/ErrorHandler.js';

describe('CounterManager', () => {
    let counterManager;
    let mockCacheManager;
    
    beforeEach(() => {
        // Mock CacheManager
        mockCacheManager = {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn()
        };
        
        // Initialize CounterManager with mocked dependencies
        counterManager = new CounterManager({
            cacheManager: mockCacheManager,
            errorHandler: ErrorHandler.getInstance()
        });
    });

    describe('constructor', () => {
        it('should throw error when CacheManager is not provided', () => {
            expect(() => new CounterManager({})).toThrow('CacheManager is required');
        });

        it('should initialize with valid dependencies', () => {
            expect(counterManager).toBeInstanceOf(CounterManager);
        });
    });

    describe('updateCounters', () => {
        it('should correctly count orders by status', async () => {
            const testOrders = [
                { status_id: '1', order_id: '1' },
                { status_id: '2', order_id: '2' },
                { status_id: '2', order_id: '3' },
                { status_id: '3', order_id: '4' },
                { status_id: '5', order_id: '5', ready_date: new Date() }
            ];

            await counterManager.updateCounters(testOrders);

            expect(mockCacheManager.set).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    counts: {
                        '1': 1,
                        '2': 2,
                        '3': 1,
                        'READY': 1,
                        'OVERDUE': 0
                    }
                }),
                expect.any(Number)
            );
        });

        it('should handle overdue orders correctly', async () => {
            const twoWeeksAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
            const testOrders = [
                { status_id: '5', order_id: '1', ready_date: twoWeeksAgo },
                { status_id: '5', order_id: '2', ready_date: new Date() }
            ];

            await counterManager.updateCounters(testOrders);

            expect(mockCacheManager.set).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    counts: {
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        'READY': 1,
                        'OVERDUE': 1
                    }
                }),
                expect.any(Number)
            );
        });

        it('should handle invalid order data gracefully', async () => {
            const testOrders = [
                { order_id: '1' }, // missing status_id
                { status_id: null, order_id: '2' },
                { status_id: '1', order_id: '3' }
            ];

            await counterManager.updateCounters(testOrders);

            expect(mockCacheManager.set).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    counts: {
                        '1': 1,
                        '2': 0,
                        '3': 0,
                        'READY': 0,
                        'OVERDUE': 0
                    }
                }),
                expect.any(Number)
            );
        });
    });

    describe('getCounters', () => {
        it('should return cached counters if available', async () => {
            const mockCachedData = {
                counts: {
                    '1': 1,
                    '2': 2,
                    '3': 3,
                    'READY': 4,
                    'OVERDUE': 5
                },
                metadata: {
                    lastUpdate: Date.now(),
                    storeId: 'TEST_STORE'
                }
            };

            mockCacheManager.get.mockResolvedValueOnce(mockCachedData);

            const result = await counterManager.getCounters();
            expect(result).toEqual(mockCachedData);
        });

        it('should return initialized counters if cache is empty', async () => {
            mockCacheManager.get.mockResolvedValueOnce(null);

            const result = await counterManager.getCounters();
            expect(result).toEqual({
                counts: {
                    '1': 0,
                    '2': 0,
                    '3': 0,
                    'READY': 0,
                    'OVERDUE': 0
                },
                metadata: expect.objectContaining({
                    initialFetch: false,
                    storeId: expect.any(String)
                })
            });
        });
    });

    describe('invalidateCounters', () => {
        it('should remove counters from cache', async () => {
            await counterManager.invalidateCounters();
            expect(mockCacheManager.remove).toHaveBeenCalled();
        });
    });

    describe('setCurrentStore', () => {
        it('should update current store ID', async () => {
            const testStoreId = 'TEST_STORE_123';
            counterManager.setCurrentStore(testStoreId);

            // Update counters to verify store ID is used
            await counterManager.updateCounters([]);

            expect(mockCacheManager.set).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        storeId: testStoreId
                    })
                }),
                expect.any(Number)
            );
        });
    });
}); 