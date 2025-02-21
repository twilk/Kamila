import { MessageManager } from '../../services/core/MessageManager.js';
import { StoreManager } from '../../services/core/StoreManager.js';
import { UIManager } from '../../services/core/UIManager.js';
import { DataManager } from '../../services/core/DataManager.js';
import { ErrorHandler } from '../../services/core/ErrorHandler.js';

// Mock chrome.storage
jest.mock('chrome.storage.local', () => ({
    get: jest.fn(),
    set: jest.fn()
}));

describe('Manager System Integration', () => {
    let messageManager;
    let storeManager;
    let uiManager;
    let dataManager;
    let errorHandler;
    let mockFetch;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock fetch
        mockFetch = jest.fn();
        global.fetch = mockFetch;

        // Mock chrome.storage
        chrome.storage.local.get.mockResolvedValue({});
        chrome.storage.local.set.mockResolvedValue();

        // Initialize managers
        errorHandler = ErrorHandler.getInstance();
        messageManager = MessageManager.getInstance();
        storeManager = StoreManager.getInstance();
        uiManager = UIManager.getInstance();
        dataManager = DataManager.getInstance();
    });

    afterEach(async () => {
        // Clean up managers
        await Promise.all([
            messageManager.dispose(),
            storeManager.dispose(),
            uiManager.dispose(),
            dataManager.dispose()
        ]);
    });

    describe('System Initialization', () => {
        it('should initialize all managers in correct order', async () => {
            const messageSpy = jest.spyOn(messageManager, 'initialize');
            const storeSpy = jest.spyOn(storeManager, 'initialize');
            const uiSpy = jest.spyOn(uiManager, 'initialize');
            const dataSpy = jest.spyOn(dataManager, 'initialize');

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    stores: [{ id: 'store1', name: 'Store 1' }]
                })
            });

            await messageManager.initialize();

            expect(messageSpy).toHaveBeenCalled();
            expect(storeSpy).toHaveBeenCalled();
            expect(uiSpy).toHaveBeenCalled();
            expect(dataSpy).toHaveBeenCalled();

            // Verify initialization order
            const calls = [
                messageSpy.mock.invocationCallOrder[0],
                storeSpy.mock.invocationCallOrder[0],
                uiSpy.mock.invocationCallOrder[0],
                dataSpy.mock.invocationCallOrder[0]
            ];

            expect(calls).toEqual([...calls].sort((a, b) => a - b));
        });

        it('should handle initialization errors gracefully', async () => {
            const mockError = new Error('Mock init error');
            jest.spyOn(storeManager, 'initialize').mockRejectedValueOnce(mockError);

            const errorSpy = jest.spyOn(errorHandler, 'handle');
            const messageSpy = jest.spyOn(messageManager, 'showError');

            await messageManager.initialize();

            expect(errorSpy).toHaveBeenCalledWith(
                mockError,
                expect.any(String),
                expect.any(String),
                expect.any(Object)
            );
            expect(messageSpy).toHaveBeenCalled();
        });
    });

    describe('Inter-Manager Communication', () => {
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

            await messageManager.initialize();
        });

        it('should handle store changes across managers', async () => {
            const uiSpy = jest.spyOn(uiManager, 'safeUpdateElement');
            const dataSpy = jest.spyOn(dataManager, 'loadFreshData');
            const messageSpy = jest.spyOn(messageManager, 'showInfo');

            await storeManager.changeStore('store2');

            expect(uiSpy).toHaveBeenCalled();
            expect(dataSpy).toHaveBeenCalled();
            expect(messageSpy).toHaveBeenCalled();
        });

        it('should propagate errors between managers', async () => {
            const mockError = new Error('Mock data error');
            jest.spyOn(dataManager, 'loadFreshData').mockRejectedValueOnce(mockError);

            const errorSpy = jest.spyOn(errorHandler, 'handle');
            const messageSpy = jest.spyOn(messageManager, 'showError');

            await storeManager.changeStore('store1');

            expect(errorSpy).toHaveBeenCalledWith(
                mockError,
                expect.any(String),
                expect.any(String),
                expect.any(Object)
            );
            expect(messageSpy).toHaveBeenCalled();
        });

        it('should handle UI updates across managers', async () => {
            const uiSpy = jest.spyOn(uiManager, 'safeUpdateElement');
            const messageSpy = jest.spyOn(messageManager, 'showInfo');

            // Simulate data update
            await dataManager.loadFreshData();

            expect(uiSpy).toHaveBeenCalled();
            expect(messageSpy).toHaveBeenCalled();
        });
    });

    describe('System Cleanup', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stores: [] })
            });
            await messageManager.initialize();
        });

        it('should dispose all managers properly', async () => {
            const messageDisposeSpy = jest.spyOn(messageManager, 'dispose');
            const storeDisposeSpy = jest.spyOn(storeManager, 'dispose');
            const uiDisposeSpy = jest.spyOn(uiManager, 'dispose');
            const dataDisposeSpy = jest.spyOn(dataManager, 'dispose');

            await messageManager.dispose();

            expect(messageDisposeSpy).toHaveBeenCalled();
            expect(storeDisposeSpy).toHaveBeenCalled();
            expect(uiDisposeSpy).toHaveBeenCalled();
            expect(dataDisposeSpy).toHaveBeenCalled();
        });

        it('should handle cleanup errors gracefully', async () => {
            const mockError = new Error('Mock cleanup error');
            jest.spyOn(storeManager, 'dispose').mockRejectedValueOnce(mockError);

            const errorSpy = jest.spyOn(errorHandler, 'handle');

            await messageManager.dispose();

            expect(errorSpy).toHaveBeenCalledWith(
                mockError,
                expect.any(String),
                expect.any(String),
                expect.any(Object)
            );
        });
    });

    describe('Error Recovery', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stores: [] })
            });
            await messageManager.initialize();
        });

        it('should recover from temporary errors', async () => {
            const mockError = new Error('Mock temporary error');
            jest.spyOn(dataManager, 'loadFreshData')
                .mockRejectedValueOnce(mockError)
                .mockResolvedValueOnce({ success: true });

            const errorSpy = jest.spyOn(errorHandler, 'handle');
            const messageSpy = jest.spyOn(messageManager, 'showError');
            const successSpy = jest.spyOn(messageManager, 'showSuccess');

            // First attempt - should fail
            await dataManager.loadFreshData();
            expect(errorSpy).toHaveBeenCalled();
            expect(messageSpy).toHaveBeenCalled();

            // Second attempt - should succeed
            await dataManager.loadFreshData();
            expect(successSpy).toHaveBeenCalled();
        });

        it('should maintain system stability during errors', async () => {
            const mockError = new Error('Mock system error');
            jest.spyOn(storeManager, 'changeStore').mockRejectedValueOnce(mockError);

            const errorSpy = jest.spyOn(errorHandler, 'handle');
            const uiSpy = jest.spyOn(uiManager, 'safeUpdateElement');

            await storeManager.changeStore('store1');

            expect(errorSpy).toHaveBeenCalled();
            expect(uiSpy).toHaveBeenCalled(); // UI should still update even after error
        });
    });
}); 