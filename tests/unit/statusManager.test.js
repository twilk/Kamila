import { StatusManager } from '../../services/core/StatusManager.js';
import { ErrorHandler } from '../../services/core/ErrorHandler.js';
import { UIManager } from '../../services/core/UIManager.js';

// Mock dependencies
jest.mock('../../services/core/ErrorHandler.js');
jest.mock('../../services/core/UIManager.js');
jest.mock('chrome.storage.local', () => ({
    get: jest.fn(),
    set: jest.fn()
}));

describe('StatusManager', () => {
    let statusManager;
    let mockUIManager;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock UIManager
        mockUIManager = {
            safeUpdateElement: jest.fn(),
            safeUpdateElements: jest.fn()
        };
        UIManager.getInstance.mockReturnValue(mockUIManager);

        // Mock chrome.storage
        chrome.storage.local.get.mockResolvedValue({});
        chrome.storage.local.set.mockResolvedValue();

        // Initialize manager
        statusManager = StatusManager.getInstance();
    });

    afterEach(() => {
        statusManager = null;
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            const result = await statusManager.initialize();
            expect(result).toBe(true);
        });

        it('should handle initialization errors', async () => {
            UIManager.getInstance.mockImplementation(() => {
                throw new Error('Mock error');
            });

            const result = await statusManager.initialize();
            expect(result).toBe(false);
            expect(ErrorHandler.getInstance().handle).toHaveBeenCalled();
        });
    });

    describe('status mapping', () => {
        it('should map status correctly', () => {
            const testCases = [
                { input: 'submitted', expected: '1' },
                { input: 'confirmed', expected: '2' },
                { input: 'accepted', expected: '3' },
                { input: 'ready', expected: 'READY' },
                { input: 'overdue', expected: 'OVERDUE' },
                { input: 'unknown', expected: 'unknown' }
            ];

            testCases.forEach(({ input, expected }) => {
                expect(StatusManager.mapStatus(input)).toBe(expected);
            });
        });

        it('should handle case-insensitive status', () => {
            expect(StatusManager.mapStatus('SUBMITTED')).toBe('1');
            expect(StatusManager.mapStatus('Confirmed')).toBe('2');
            expect(StatusManager.mapStatus('aCcEpTeD')).toBe('3');
        });
    });

    describe('order counts', () => {
        beforeEach(async () => {
            await statusManager.initialize();
        });

        it('should update order counts', async () => {
            const counts = {
                '1': 5,
                '2': 3,
                '3': 2,
                'READY': 1,
                'OVERDUE': 0
            };

            await statusManager.updateOrderCounts(counts);

            // Verify UI updates
            expect(mockUIManager.safeUpdateElement).toHaveBeenCalledTimes(5);
            
            // Verify storage update
            expect(chrome.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderCounts: counts
                })
            );
        });

        it('should handle missing counts', async () => {
            const partialCounts = {
                '1': 5,
                '2': 3
            };

            await statusManager.updateOrderCounts(partialCounts);

            // Verify all counters are updated
            expect(mockUIManager.safeUpdateElement).toHaveBeenCalledTimes(5);
        });

        it('should animate count changes', async () => {
            // First update
            await statusManager.updateOrderCounts({
                '1': 5,
                '2': 3
            });

            // Second update with changes
            await statusManager.updateOrderCounts({
                '1': 6, // Increased
                '2': 2  // Decreased
            }, true);

            // Verify animation classes
            const calls = mockUIManager.safeUpdateElement.mock.calls;
            const updateFns = calls.map(call => call[1]);

            // Test animation on mock elements
            updateFns.forEach(fn => {
                const mockElement = {
                    textContent: '',
                    classList: {
                        add: jest.fn(),
                        remove: jest.fn()
                    }
                };
                fn(mockElement);

                expect(mockElement.classList.add).toHaveBeenCalledWith('count-changed');
            });
        });
    });

    describe('service status', () => {
        beforeEach(async () => {
            await statusManager.initialize();
        });

        it('should update service status', () => {
            statusManager.updateStatus('api', true);
            expect(mockUIManager.safeUpdateElement).toHaveBeenCalledWith(
                '#api-status',
                expect.any(Function)
            );
        });

        it('should handle status object', () => {
            statusManager.updateStatus('api', {
                status: 'online',
                message: 'API is working'
            });

            expect(chrome.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    'status_api': expect.objectContaining({
                        isOnline: true
                    })
                })
            );
        });

        it('should check all services', async () => {
            await statusManager.checkAllServices();

            // Verify all services were checked
            const services = ['api', 'auth', 'orders', 'cache'];
            services.forEach(service => {
                expect(mockUIManager.safeUpdateElement).toHaveBeenCalledWith(
                    `#${service}-status`,
                    expect.any(Function)
                );
            });
        });
    });

    describe('error handling', () => {
        beforeEach(async () => {
            await statusManager.initialize();
        });

        it('should handle update status errors', () => {
            chrome.storage.local.set.mockRejectedValue(new Error('Mock storage error'));
            
            statusManager.updateStatus('api', true);
            expect(ErrorHandler.getInstance().handle).toHaveBeenCalled();
        });

        it('should handle service check errors', async () => {
            chrome.storage.local.get.mockRejectedValue(new Error('Mock check error'));
            
            await statusManager.checkAllServices();
            expect(ErrorHandler.getInstance().handle).toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        beforeEach(async () => {
            await statusManager.initialize();
        });

        it('should dispose properly', async () => {
            await statusManager.dispose();
            expect(mockUIManager.safeUpdateElement).toHaveBeenCalled();
        });

        it('should handle dispose errors', async () => {
            const mockError = new Error('Mock dispose error');
            mockUIManager.safeUpdateElement.mockImplementation(() => {
                throw mockError;
            });

            await statusManager.dispose();
            expect(ErrorHandler.getInstance().handle).toHaveBeenCalledWith(
                mockError,
                expect.any(String),
                expect.any(String),
                expect.objectContaining({ method: 'dispose' })
            );
        });
    });
}); 