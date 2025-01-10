import { UIManager } from '../services/uiManager';
import { BaseManager } from '../services/core/BaseManager';
import { ErrorType } from '../services/core/ErrorTypes';
import {
    setupChromeApi,
    setupBootstrapApi,
    createMockMetricsManager,
    setupTestDom,
    cleanupTestEnvironment,
    setupMockStorage,
    flushPromises,
    createMockEvent,
    setupPerformanceApi,
    setupConsoleMocks,
    restoreConsole
} from './helpers/testUtils';

describe('UIManager Integration Tests', () => {
    let uiManager;
    let mockMetrics;
    let originalConsole;

    beforeAll(() => {
        setupChromeApi();
        setupBootstrapApi();
        setupPerformanceApi();
        originalConsole = setupConsoleMocks();
    });

    beforeEach(() => {
        setupTestDom();
        setupMockStorage();
        mockMetrics = createMockMetricsManager();
        BaseManager.metricsManager = mockMetrics;
        uiManager = new UIManager();
    });

    afterEach(() => {
        cleanupTestEnvironment();
    });

    afterAll(() => {
        restoreConsole(originalConsole);
    });

    describe('Initialization', () => {
        it('should initialize all components successfully', async () => {
            const result = await uiManager.initialize();
            await flushPromises();
            
            expect(result).toBe(true);
            expect(mockMetrics.trackOperation).toHaveBeenCalledWith(
                'UIManager_initialize',
                expect.any(Function)
            );
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('initialized')
            );
        });

        it('should initialize UI components in parallel', async () => {
            const spy = jest.spyOn(Promise, 'all');
            await uiManager.initialize();
            await flushPromises();
            
            expect(spy).toHaveBeenCalled();
            expect(mockMetrics.trackOperation).toHaveBeenCalledWith(
                'UIManager_initComponents',
                expect.any(Function)
            );
            
            spy.mockRestore();
        });

        it('should set up ResizeObserver', async () => {
            const spy = jest.spyOn(window, 'ResizeObserver');
            await uiManager.initialize();
            await flushPromises();
            
            expect(spy).toHaveBeenCalled();
            expect(uiManager.resizeObserver).toBeTruthy();
            
            spy.mockRestore();
        });
    });

    describe('Counter Management', () => {
        beforeEach(async () => {
            await uiManager.initialize();
            await flushPromises();
        });

        it('should initialize counters correctly', () => {
            expect(uiManager.counters.size).toBe(2);
            expect(uiManager.counters.has('counter1')).toBe(true);
            expect(uiManager.counters.has('counter2')).toBe(true);
            expect(mockMetrics.trackOperation).toHaveBeenCalledWith(
                'UIManager_initCounters',
                expect.any(Function)
            );
        });

        it('should update counters with debouncing', async () => {
            jest.useFakeTimers();
            
            await uiManager.loadAndUpdateCounters('store1');
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 100);
            
            jest.runAllTimers();
            await flushPromises();
            
            const counter1 = document.querySelector('[data-counter="counter1"] .count');
            const counter2 = document.querySelector('[data-counter="counter2"] .count');
            
            expect(counter1.textContent).toBe('5');
            expect(counter2.textContent).toBe('10');
            expect(mockMetrics.trackOperation).toHaveBeenCalledWith(
                'UIManager_loadCounters',
                expect.any(Function)
            );
            
            jest.useRealTimers();
        });

        it('should handle counter updates in batches', async () => {
            const spy = jest.spyOn(window, 'requestAnimationFrame');
            
            await uiManager.updateCounters({ counter1: 15, counter2: 20 });
            await flushPromises();
            
            expect(spy).toHaveBeenCalled();
            expect(mockMetrics.trackOperation).toHaveBeenCalledWith(
                'UIManager_updateCounters',
                expect.any(Function)
            );
            
            const counter1 = document.querySelector('[data-counter="counter1"] .count');
            const counter2 = document.querySelector('[data-counter="counter2"] .count');
            
            expect(counter1.textContent).toBe('15');
            expect(counter2.textContent).toBe('20');
            
            spy.mockRestore();
        });
    });

    describe('Store Selection', () => {
        beforeEach(async () => {
            await uiManager.initialize();
            await flushPromises();
        });

        it('should load saved store selection', () => {
            const select = document.getElementById('store-select');
            expect(select.value).toBe('store1');
        });

        it('should handle store changes', async () => {
            const select = document.getElementById('store-select');
            select.value = 'store2';
            select.dispatchEvent(new Event('change'));
            await flushPromises();
            
            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                selectedStore: 'store2'
            });
            expect(mockMetrics.trackOperation).toHaveBeenCalledWith(
                'UIManager_loadCounters',
                expect.any(Function)
            );
        });

        it('should emit store change event', async () => {
            const eventSpy = jest.fn();
            document.addEventListener('storeChange', eventSpy);
            
            const select = document.getElementById('store-select');
            select.value = 'store2';
            select.dispatchEvent(new Event('change'));
            await flushPromises();
            
            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    detail: { store: 'store2' }
                })
            );
            
            document.removeEventListener('storeChange', eventSpy);
        });
    });

    describe('Error Handling', () => {
        it('should handle initialization errors gracefully', async () => {
            const errorSpy = jest.spyOn(uiManager, 'handleError');
            chrome.storage.local.get.mockRejectedValueOnce(new Error('Test error'));
            
            await uiManager.initialize();
            await flushPromises();
            
            expect(errorSpy).toHaveBeenCalledWith(
                expect.any(Error),
                ErrorType.UI,
                expect.any(String),
                expect.any(Object)
            );
            expect(console.error).toHaveBeenCalled();
            
            errorSpy.mockRestore();
        });

        it('should handle counter update errors', async () => {
            await uiManager.initialize();
            await flushPromises();
            
            const errorSpy = jest.spyOn(uiManager, 'handleError');
            chrome.runtime.sendMessage.mockRejectedValueOnce(new Error('API error'));
            
            await uiManager.loadAndUpdateCounters('store1');
            await flushPromises();
            
            expect(errorSpy).toHaveBeenCalledWith(
                expect.any(Error),
                ErrorType.UI,
                expect.any(String),
                expect.objectContaining({
                    method: 'loadAndUpdateCounters'
                })
            );
            
            errorSpy.mockRestore();
        });
    });

    describe('Cleanup', () => {
        beforeEach(async () => {
            await uiManager.initialize();
            await flushPromises();
        });

        it('should clean up all resources on dispose', async () => {
            const disconnectSpy = jest.spyOn(uiManager.resizeObserver, 'disconnect');
            const tooltipDisposeSpy = jest.spyOn(bootstrap.Tooltip.prototype, 'dispose');
            
            await uiManager.dispose();
            await flushPromises();
            
            expect(disconnectSpy).toHaveBeenCalled();
            expect(tooltipDisposeSpy).toHaveBeenCalled();
            expect(uiManager.counters.size).toBe(0);
            expect(uiManager.tooltipList.length).toBe(0);
            
            disconnectSpy.mockRestore();
            tooltipDisposeSpy.mockRestore();
        });

        it('should clear all timeouts', async () => {
            jest.useFakeTimers();
            
            await uiManager.loadAndUpdateCounters('store1');
            await uiManager.dispose();
            await flushPromises();
            
            expect(clearTimeout).toHaveBeenCalled();
            
            jest.useRealTimers();
        });
    });

    describe('Performance Metrics', () => {
        it('should track all major operations', async () => {
            await uiManager.initialize();
            await flushPromises();
            
            expect(mockMetrics.trackOperation).toHaveBeenCalledWith(
                'UIManager_initialize',
                expect.any(Function)
            );
            expect(mockMetrics.trackOperation).toHaveBeenCalledWith(
                'UIManager_initComponents',
                expect.any(Function)
            );
            expect(mockMetrics.trackOperation).toHaveBeenCalledWith(
                'UIManager_initCounters',
                expect.any(Function)
            );
            expect(mockMetrics.trackOperation).toHaveBeenCalledWith(
                'UIManager_loadCounters',
                expect.any(Function)
            );
        });

        it('should use requestAnimationFrame for UI updates', async () => {
            const rafSpy = jest.spyOn(window, 'requestAnimationFrame');
            
            await uiManager.initialize();
            await uiManager.updateCounters({ counter1: 1, counter2: 2 });
            await flushPromises();
            
            expect(rafSpy).toHaveBeenCalled();
            
            rafSpy.mockRestore();
        });
    });
}); 