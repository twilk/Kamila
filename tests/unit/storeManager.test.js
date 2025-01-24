import { StoreManager } from '../../services/core/StoreManager.js';
import { ErrorHandler } from '../../services/core/ErrorHandler.js';
import { UIManager } from '../../services/core/UIManager.js';
import { DataManager } from '../../services/core/DataManager.js';

// Mock dependencies
jest.mock('../../services/core/ErrorHandler.js');
jest.mock('../../services/core/UIManager.js');
jest.mock('../../services/core/DataManager.js');
jest.mock('chrome.storage.local', () => ({
    get: jest.fn(),
    set: jest.fn()
}));

describe('StoreManager', () => {
    let storeManager;
    let mockUIManager;
    let mockDataManager;
    let mockFetch;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock UIManager
        mockUIManager = {
            safeUpdateElement: jest.fn()
        };
        UIManager.getInstance.mockReturnValue(mockUIManager);

        // Mock DataManager
        mockDataManager = {};
        DataManager.getInstance.mockReturnValue(mockDataManager);

        // Mock chrome.storage
        chrome.storage.local.get.mockResolvedValue({});
        chrome.storage.local.set.mockResolvedValue();

        // Mock fetch
        mockFetch = jest.fn();
        global.fetch = mockFetch;

        // Initialize manager
        storeManager = StoreManager.getInstance();
    });

    afterEach(() => {
        storeManager = null;
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    stores: [
                        { id: 'store1', name: 'Store 1' }
                    ]
                })
            });

            const result = await storeManager.initialize();
            expect(result).toBe(true);
            expect(mockUIManager.safeUpdateElement).toHaveBeenCalled();
        });

        it('should handle initialization errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Mock error'));

            const result = await storeManager.initialize();
            expect(result).toBe(false);
            expect(ErrorHandler.getInstance().handle).toHaveBeenCalled();
        });

        it('should load last selected store', async () => {
            const mockStore = { id: 'store1', name: 'Store 1' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    stores: [mockStore]
                })
            });

            chrome.storage.local.get.mockResolvedValueOnce({
                lastStore: 'store1'
            });

            await storeManager.initialize();
            expect(storeManager.getCurrentStore()).toEqual(mockStore);
        });
    });

    describe('store loading', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    stores: [
                        { id: 'store1', name: 'Store 1' },
                        { id: 'store2', name: 'Store 2' }
                    ]
                })
            });
            await storeManager.initialize();
        });

        it('should load stores from cache', async () => {
            const mockStores = [
                { id: 'store1', name: 'Store 1' }
            ];

            chrome.storage.local.get.mockResolvedValueOnce({
                [StoreManager.CACHE_CONFIG.key]: {
                    data: mockStores,
                    timestamp: Date.now(),
                    cacheVersion: StoreManager.CACHE_CONFIG.version
                }
            });

            await storeManager._loadStores();
            expect(mockFetch).not.toHaveBeenCalled();
            expect(storeManager.getStores().size).toBe(1);
        });

        it('should fetch fresh stores when cache is expired', async () => {
            chrome.storage.local.get.mockResolvedValueOnce({
                [StoreManager.CACHE_CONFIG.key]: {
                    data: [],
                    timestamp: Date.now() - (StoreManager.CACHE_CONFIG.expiration + 1000),
                    cacheVersion: StoreManager.CACHE_CONFIG.version
                }
            });

            const mockStores = {
                stores: [
                    { id: 'store1', name: 'Store 1' }
                ]
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockStores)
            });

            await storeManager._loadStores();
            expect(mockFetch).toHaveBeenCalled();
            expect(storeManager.getStores().size).toBe(1);
        });

        it('should validate store data', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    stores: [
                        { id: 'store1' }, // Missing name
                        { name: 'Store 2' }, // Missing id
                        { id: 'store3', name: 'Store 3' } // Valid
                    ]
                })
            });

            await storeManager._loadStores();
            expect(storeManager.getStores().size).toBe(1);
            expect(storeManager.getStores().get('store3')).toBeTruthy();
        });
    });

    describe('store selection', () => {
        const mockStores = [
            { id: 'store1', name: 'Store 1' },
            { id: 'store2', name: 'Store 2' }
        ];

        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stores: mockStores })
            });
            await storeManager.initialize();
        });

        it('should change store successfully', async () => {
            const result = await storeManager.changeStore('store1');
            expect(result).toBe(true);
            expect(storeManager.getCurrentStore()).toEqual(mockStores[0]);
            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                lastStore: 'store1'
            });
        });

        it('should handle invalid store ID', async () => {
            const result = await storeManager.changeStore('invalid');
            expect(result).toBe(false);
            expect(ErrorHandler.getInstance().handle).toHaveBeenCalled();
        });

        it('should trigger store change event', async () => {
            const eventSpy = jest.spyOn(window, 'dispatchEvent');
            
            await storeManager.changeStore('store1');
            
            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'store:change',
                    detail: { storeId: 'store1' }
                })
            );
        });

        it('should update UI on store change', async () => {
            await storeManager.changeStore('store1');
            expect(mockUIManager.safeUpdateElement).toHaveBeenCalledWith(
                '#storeSelector',
                expect.any(Function)
            );
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

        it('should use test stores in offline mode', async () => {
            await storeManager.initialize();
            const stores = storeManager.getStores();
            expect(stores.size).toBe(3); // Test stores count
            expect(stores.get('store1')).toBeTruthy();
            expect(stores.get('store2')).toBeTruthy();
            expect(stores.get('store3')).toBeTruthy();
        });
    });

    describe('cleanup', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stores: [] })
            });
            await storeManager.initialize();
        });

        it('should dispose properly', async () => {
            await storeManager.dispose();
            expect(storeManager.getCurrentStore()).toBeNull();
            expect(storeManager.getStores().size).toBe(0);
        });

        it('should handle dispose errors', async () => {
            const mockError = new Error('Mock dispose error');
            mockUIManager.safeUpdateElement.mockImplementation(() => {
                throw mockError;
            });

            await storeManager.dispose();
            expect(ErrorHandler.getInstance().handle).toHaveBeenCalledWith(
                mockError,
                expect.any(String),
                expect.any(String),
                expect.objectContaining({ method: 'dispose' })
            );
        });
    });
}); 