import { DataManager } from '../../services/core/DataManager.js';
import { ErrorHandler } from '../../services/core/ErrorHandler.js';
import { StatusManager } from '../../services/core/StatusManager.js';

// Mock dependencies
jest.mock('../../services/core/ErrorHandler.js');
jest.mock('../../services/core/StatusManager.js');
jest.mock('chrome.storage.local', () => ({
    get: jest.fn(),
    set: jest.fn()
}));

describe('DataManager', () => {
    let dataManager;
    let mockStatusManager;
    let mockFetch;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock StatusManager
        mockStatusManager = {
            updateOrderCounts: jest.fn(),
            constructor: {
                mapStatus: jest.fn(status => status)
            }
        };
        StatusManager.getInstance.mockReturnValue(mockStatusManager);

        // Mock chrome.storage
        chrome.storage.local.get.mockResolvedValue({});
        chrome.storage.local.set.mockResolvedValue();

        // Mock fetch
        mockFetch = jest.fn();
        global.fetch = mockFetch;

        // Initialize manager
        dataManager = DataManager.getInstance();
    });

    afterEach(() => {
        dataManager = null;
        jest.useRealTimers();
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ orders: [] })
            });

            const result = await dataManager.initialize();
            expect(result).toBe(true);
        });

        it('should handle initialization errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Mock error'));

            const result = await dataManager.initialize();
            expect(result).toBe(false);
            expect(ErrorHandler.getInstance().handle).toHaveBeenCalled();
        });

        it('should setup refresh timer', async () => {
            jest.useFakeTimers();
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ orders: [] })
            });

            await dataManager.initialize();

            // Verify timer was set
            expect(setInterval).toHaveBeenCalledWith(
                expect.any(Function),
                DataManager.REFRESH_CONFIG.interval
            );
        });
    });

    describe('data loading', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ orders: [] })
            });
            await dataManager.initialize();
        });

        it('should load data from cache', async () => {
            const mockData = {
                orders: [
                    { id: '1', status: 'submitted' }
                ]
            };

            chrome.storage.local.get.mockResolvedValueOnce({
                [DataManager.CACHE_CONFIG.key]: {
                    data: mockData,
                    timestamp: Date.now(),
                    cacheVersion: DataManager.CACHE_CONFIG.version
                }
            });

            const result = await dataManager.loadAndUpdateData();
            expect(result).toBe(true);
            expect(mockStatusManager.updateOrderCounts).toHaveBeenCalled();
        });

        it('should fetch fresh data when cache is expired', async () => {
            // Set expired cache
            chrome.storage.local.get.mockResolvedValueOnce({
                [DataManager.CACHE_CONFIG.key]: {
                    data: { orders: [] },
                    timestamp: Date.now() - (DataManager.CACHE_CONFIG.expiration + 1000),
                    cacheVersion: DataManager.CACHE_CONFIG.version
                }
            });

            const mockData = {
                orders: [
                    { id: '1', status: 'submitted' }
                ]
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockData)
            });

            const result = await dataManager.loadAndUpdateData();
            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalled();
        });

        it('should handle API errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            const result = await dataManager.loadAndUpdateData(true);
            expect(result).toBe(false);
            expect(ErrorHandler.getInstance().handle).toHaveBeenCalled();
        });

        it('should validate data format', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ invalid: 'data' })
            });

            const result = await dataManager.loadAndUpdateData(true);
            expect(result).toBe(false);
            expect(ErrorHandler.getInstance().handle).toHaveBeenCalled();
        });
    });

    describe('event handling', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ orders: [] })
            });
            await dataManager.initialize();
        });

        it('should handle refresh events', async () => {
            const mockData = { orders: [] };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockData)
            });

            window.dispatchEvent(new CustomEvent('data:refresh'));
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockFetch).toHaveBeenCalled();
        });

        it('should handle store change events', async () => {
            const mockData = { orders: [] };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockData)
            });

            window.dispatchEvent(new CustomEvent('store:change'));
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockFetch).toHaveBeenCalled();
        });
    });

    describe('offline mode', () => {
        beforeEach(() => {
            // Mock offline state
            Object.defineProperty(navigator, 'onLine', {
                value: false,
                writable: true
            });
        });

        it('should use test data in offline mode', async () => {
            const result = await dataManager.loadAndUpdateData(true);
            expect(result).toBe(true);
            expect(mockFetch).not.toHaveBeenCalled();
            expect(mockStatusManager.updateOrderCounts).toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ orders: [] })
            });
            await dataManager.initialize();
        });

        it('should dispose properly', async () => {
            jest.useFakeTimers();
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

            await dataManager.dispose();

            expect(clearIntervalSpy).toHaveBeenCalled();
        });

        it('should handle dispose errors', async () => {
            const mockError = new Error('Mock dispose error');
            jest.spyOn(global, 'clearInterval').mockImplementation(() => {
                throw mockError;
            });

            await dataManager.dispose();
            expect(ErrorHandler.getInstance().handle).toHaveBeenCalledWith(
                mockError,
                expect.any(String),
                expect.any(String),
                expect.objectContaining({ method: 'dispose' })
            );
        });
    });
}); 