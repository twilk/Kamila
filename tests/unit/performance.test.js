import { PerformanceMonitor } from '../../services/performance.js';

describe('PerformanceMonitor', () => {
    let monitor;
    let originalPerformance;
    let originalRAF;
    let originalPerformanceObserver;

    beforeEach(() => {
        // Zachowaj oryginalne obiekty
        originalPerformance = global.performance;
        originalRAF = global.requestAnimationFrame;
        originalPerformanceObserver = global.PerformanceObserver;

        // Mock Performance API
        global.performance = {
            mark: jest.fn(),
            measure: jest.fn(),
            clearMarks: jest.fn(),
            clearMeasures: jest.fn(),
            now: jest.fn(() => Date.now())
        };

        // Mock PerformanceObserver
        global.PerformanceObserver = class {
            constructor(callback) {
                this.callback = callback;
            }
            observe(options) {
                this.options = options;
            }
            disconnect() {}
        };

        // Mock requestAnimationFrame
        global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));

        monitor = new PerformanceMonitor();
        jest.useFakeTimers();
    });

    afterEach(() => {
        // Przywróć oryginalne obiekty
        global.performance = originalPerformance;
        global.requestAnimationFrame = originalRAF;
        global.PerformanceObserver = originalPerformanceObserver;
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        test('should setup performance observers', () => {
            const observeSpy = jest.spyOn(PerformanceObserver.prototype, 'observe');
            new PerformanceMonitor();

            expect(observeSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    entryTypes: expect.arrayContaining(['longtask'])
                })
            );
            expect(observeSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    entryTypes: expect.arrayContaining([
                        'layout-shift',
                        'paint',
                        'largest-contentful-paint'
                    ])
                })
            );
        });
    });

    describe('Performance Measurements', () => {
        test('should track operation timing', () => {
            const startTime = Date.now();
            monitor.startMeasure('test-operation');
            
            jest.advanceTimersByTime(100);
            
            const duration = monitor.endMeasure('test-operation');
            
            expect(duration).toBeGreaterThanOrEqual(100);
            expect(monitor.metrics.measures.get('test-operation')).toBeDefined();
        });

        test('should handle multiple concurrent measurements', () => {
            monitor.startMeasure('op1');
            jest.advanceTimersByTime(50);
            
            monitor.startMeasure('op2');
            jest.advanceTimersByTime(50);
            
            const duration2 = monitor.endMeasure('op2');
            jest.advanceTimersByTime(50);
            
            const duration1 = monitor.endMeasure('op1');
            
            expect(duration1).toBeGreaterThanOrEqual(150);
            expect(duration2).toBeGreaterThanOrEqual(50);
        });
    });

    describe('DOM Operations', () => {
        test('should batch multiple DOM updates', async () => {
            const updates = [
                jest.fn(),
                jest.fn(),
                jest.fn()
            ];

            await monitor.batchDOMUpdates(() => {
                updates.forEach(update => update());
            });

            updates.forEach(update => {
                expect(update).toHaveBeenCalledTimes(1);
            });
            expect(global.requestAnimationFrame).toHaveBeenCalledTimes(1);
        });

        test('should measure DOM update duration', async () => {
            const slowUpdate = () => {
                jest.advanceTimersByTime(50);
            };

            await monitor.batchDOMUpdates(slowUpdate);
            const metrics = monitor.getMetrics();

            expect(metrics.measures['dom-updates']).toBeGreaterThanOrEqual(50);
        });
    });

    describe('Storage Operations', () => {
        test('should optimize localStorage writes', async () => {
            const operation = jest.fn(() => {
                localStorage.setItem('test', 'value');
            });

            await monitor.optimizeStorageOperation(operation);

            expect(operation).toHaveBeenCalledTimes(1);
            expect(monitor.metrics.measures.has('storage-op')).toBe(true);
        });

        test('should handle async storage operations', async () => {
            const asyncOperation = jest.fn(() => 
                new Promise(resolve => setTimeout(resolve, 100))
            );

            const promise = monitor.optimizeStorageOperation(asyncOperation);
            jest.advanceTimersByTime(100);
            await promise;

            expect(asyncOperation).toHaveBeenCalled();
        });
    });

    describe('Metrics Collection', () => {
        test('should track long tasks', () => {
            const longTask = { duration: 100 };
            monitor.metrics.longTasks.push(longTask);

            const metrics = monitor.getMetrics();
            expect(metrics.longTasks).toBe(1);
            expect(metrics.totalBlockingTime).toBe(100);
        });

        test('should track layout shifts', () => {
            monitor.metrics.layoutShifts = [
                { value: 0.1 },
                { value: 0.2 }
            ];

            const metrics = monitor.getMetrics();
            expect(metrics.layoutShifts).toBe(2);
        });

        test('should clear all metrics', () => {
            monitor.metrics.longTasks.push({ duration: 100 });
            monitor.metrics.layoutShifts = [{ value: 0.1 }];
            monitor.metrics.measures.set('test', 100);

            monitor.clearMetrics();

            const metrics = monitor.getMetrics();
            expect(metrics.longTasks).toBe(0);
            expect(metrics.layoutShifts).toBe(0);
            expect(Object.keys(metrics.measures)).toHaveLength(0);
        });
    });
}); 