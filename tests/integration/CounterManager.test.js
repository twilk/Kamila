import { CounterManager } from '../../services/core/CounterManager.js';
import { OrderService } from '../../services/core/OrderService.js';
import { EventManager } from '../../services/core/EventManager.js';
import { StoreManager } from '../../services/core/StoreManager.js';

describe('CounterManager Integration', () => {
    let counterManager;
    let orderService;
    let eventManager;
    let storeManager;
    let registry;

    beforeEach(async () => {
        // Setup DOM
        document.body.innerHTML = `
            <div class="counter-group">
                <div id="count-untouched" class="order-counter">0</div>
                <div id="count-called" class="order-counter">0</div>
                <div id="count-ready" class="order-counter">0</div>
                <div id="count-overdue" class="order-counter">0</div>
                <div id="count-critical" class="order-counter">0</div>
                <div id="total-count" class="order-counter">0</div>
            </div>
        `;

        // Create registry
        registry = {
            get: jest.fn((name) => {
                switch (name) {
                    case 'event': return eventManager;
                    case 'store': return storeManager;
                    case 'counter': return counterManager;
                    default: return null;
                }
            })
        };

        // Initialize managers
        eventManager = new EventManager(registry);
        storeManager = new StoreManager(registry);
        counterManager = new CounterManager(registry);
        orderService = new OrderService(registry);

        // Initialize all managers
        await Promise.all([
            eventManager._initialize(),
            storeManager._initialize(),
            counterManager._initialize(),
            orderService._initialize()
        ]);
    });

    afterEach(async () => {
        // Cleanup
        await Promise.all([
            counterManager._dispose(),
            orderService._dispose(),
            eventManager._dispose(),
            storeManager._dispose()
        ]);
    });

    describe('Order Status Updates', () => {
        it('should update counters when orders change', async () => {
            // Register counters
            await Promise.all([
                'untouched',
                'called',
                'ready',
                'overdue',
                'critical',
                'total'
            ].map(status => {
                const element = document.getElementById(`count-${status}`);
                return counterManager.registerCounter(element, 0);
            }));

            // Mock API response
            const mockOrders = [
                { status_id: '1', created_at: new Date().toISOString() },
                { status_id: '2', created_at: new Date().toISOString() },
                { status_id: '3', created_at: new Date().toISOString() },
                { status_id: '5', created_at: new Date().toISOString() },
                { status_id: '1', created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() } // 8 days old
            ];

            // Update orders
            await orderService.updateOrders('TEST_STORE', mockOrders);

            // Wait for animations
            await new Promise(resolve => setTimeout(resolve, 500));

            // Verify counter values
            expect(document.getElementById('count-untouched').textContent).toBe('2');
            expect(document.getElementById('count-called').textContent).toBe('1');
            expect(document.getElementById('count-ready').textContent).toBe('1');
            expect(document.getElementById('count-critical').textContent).toBe('1');
            expect(document.getElementById('total-count').textContent).toBe('5');
        });

        it('should handle rapid order updates', async () => {
            // Register counters
            await Promise.all([
                'untouched',
                'called',
                'ready',
                'overdue',
                'critical',
                'total'
            ].map(status => {
                const element = document.getElementById(`count-${status}`);
                return counterManager.registerCounter(element, 0);
            }));

            // Create multiple updates
            const updates = [
                [
                    { status_id: '1', created_at: new Date().toISOString() }
                ],
                [
                    { status_id: '1', created_at: new Date().toISOString() },
                    { status_id: '2', created_at: new Date().toISOString() }
                ],
                [
                    { status_id: '1', created_at: new Date().toISOString() },
                    { status_id: '2', created_at: new Date().toISOString() },
                    { status_id: '3', created_at: new Date().toISOString() }
                ]
            ];

            // Trigger rapid updates
            await Promise.all(
                updates.map(orders => orderService.updateOrders('TEST_STORE', orders))
            );

            // Wait for debounce and animations
            await new Promise(resolve => setTimeout(resolve, 500));

            // Verify final state
            expect(document.getElementById('count-untouched').textContent).toBe('2');
            expect(document.getElementById('count-called').textContent).toBe('1');
            expect(document.getElementById('total-count').textContent).toBe('3');
        });
    });

    describe('Cache Integration', () => {
        it('should restore counter values from cache on initialization', async () => {
            // Set initial cache
            const mockCache = {
                'count-untouched': { value: 5, timestamp: Date.now() },
                'count-called': { value: 3, timestamp: Date.now() },
                'count-ready': { value: 2, timestamp: Date.now() },
                'total-count': { value: 10, timestamp: Date.now() }
            };

            await storeManager.set('counters', mockCache);

            // Create new instance
            const newCounterManager = new CounterManager(registry);
            await newCounterManager._initialize();

            // Verify restored values
            expect(document.getElementById('count-untouched').textContent).toBe('5');
            expect(document.getElementById('count-called').textContent).toBe('3');
            expect(document.getElementById('count-ready').textContent).toBe('2');
            expect(document.getElementById('total-count').textContent).toBe('10');
        });

        it('should handle cache expiration', async () => {
            // Set expired cache
            const mockCache = {
                'count-untouched': {
                    value: 5,
                    timestamp: Date.now() - (6 * 60 * 1000) // 6 minutes old
                }
            };

            await storeManager.set('counters', mockCache);

            // Create new instance
            const newCounterManager = new CounterManager(registry);
            await newCounterManager._initialize();

            // Verify expired value was not restored
            expect(document.getElementById('count-untouched').textContent).toBe('0');
        });
    });

    describe('Event Integration', () => {
        it('should emit events for counter changes', async () => {
            const events = [];
            await eventManager.on('counter:updated', (event) => {
                events.push(event);
            });

            // Register and update counter
            const element = document.getElementById('count-untouched');
            await counterManager.registerCounter(element, 0);
            await counterManager.updateCounter('count-untouched', 5);

            // Wait for events
            await new Promise(resolve => setTimeout(resolve, 150));

            // Verify events
            expect(events).toHaveLength(1);
            expect(events[0]).toEqual(
                expect.objectContaining({
                    id: 'count-untouched',
                    value: 5,
                    previousValue: 0
                })
            );
        });

        it('should handle event subscription cleanup', async () => {
            const handler = jest.fn();
            await eventManager.on('counter:updated', handler);

            // Update counter
            const element = document.getElementById('count-untouched');
            await counterManager.registerCounter(element, 0);
            await counterManager.updateCounter('count-untouched', 5);

            // Wait for events
            await new Promise(resolve => setTimeout(resolve, 150));

            // Verify handler was called
            expect(handler).toHaveBeenCalledTimes(1);

            // Dispose
            await eventManager._dispose();

            // Update again
            await counterManager.updateCounter('count-untouched', 10);

            // Verify handler was not called again
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('Error Handling', () => {
        it('should handle missing counter elements gracefully', async () => {
            document.body.innerHTML = ''; // Remove all elements

            // Try to register non-existent counter
            const element = document.createElement('div');
            element.id = 'non-existent';
            await counterManager.registerCounter(element);

            // Should not throw
            await counterManager.updateCounter('non-existent', 5);
        });

        it('should handle invalid counter IDs', async () => {
            await expect(
                counterManager.updateCounter('invalid-id', 5)
            ).rejects.toThrow();
        });

        it('should handle concurrent updates', async () => {
            const element = document.getElementById('count-untouched');
            await counterManager.registerCounter(element, 0);

            // Trigger multiple concurrent updates
            await Promise.all([
                counterManager.updateCounter('count-untouched', 1),
                counterManager.updateCounter('count-untouched', 2),
                counterManager.updateCounter('count-untouched', 3)
            ]);

            // Wait for debounce
            await new Promise(resolve => setTimeout(resolve, 150));

            // Should have last value
            expect(element.textContent).toBe('3');
        });
    });

    describe('Performance', () => {
        it('should handle large number of updates efficiently', async () => {
            const element = document.getElementById('count-untouched');
            await counterManager.registerCounter(element, 0);

            const start = performance.now();

            // Trigger 100 rapid updates
            for (let i = 0; i < 100; i++) {
                await counterManager.updateCounter('count-untouched', i);
            }

            // Wait for debounce
            await new Promise(resolve => setTimeout(resolve, 150));

            const duration = performance.now() - start;

            // Should complete in reasonable time
            expect(duration).toBeLessThan(1000);

            // Should have final value
            expect(element.textContent).toBe('99');
        });

        it('should batch counter updates', async () => {
            const counters = ['untouched', 'called', 'ready', 'total'];
            const elements = counters.map(id => document.getElementById(`count-${id}`));

            // Register all counters
            await Promise.all(
                elements.map(element => counterManager.registerCounter(element, 0))
            );

            const updateSpy = jest.spyOn(counterManager, 'updateCounter');

            // Update all counters rapidly
            await Promise.all(
                counters.map(id => counterManager.updateCounter(`count-${id}`, 5))
            );

            // Wait for debounce
            await new Promise(resolve => setTimeout(resolve, 150));

            // Should batch updates
            expect(updateSpy).toHaveBeenCalledTimes(counters.length);
            expect(elements.every(el => el.textContent === '5')).toBe(true);
        });
    });
}); 