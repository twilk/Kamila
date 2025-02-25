import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';

/**
 * Manager responsible for handling order counter UI updates
 */
class CounterManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;
    #boundHandler = null;

    constructor(registry) {
        if (CounterManager.#instance) {
            return CounterManager.#instance;
        }
        super(registry, 'CounterManager');
        CounterManager.#instance = this;
        CounterManager._registry = registry;

        // Only need event dependency for listening to updates
        this.addDependency('event');
        // Bind handler once
        this.#boundHandler = this.handleDataUpdate.bind(this);
    }

    static getInstance() {
        if (!CounterManager.#instance && CounterManager._registry) {
            CounterManager.#instance = new CounterManager(CounterManager._registry);
        }
        return CounterManager.#instance;
    }

    static setRegistry(registry) {
        CounterManager._registry = registry;
    }

    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing counter manager...');
            
            // Setup single event listener for counter updates
            const eventManager = await this.getDependency('event');
            console.log('💩 [COUNTER] Got event manager, adding listener');
            
            const result = await eventManager.on('counters:updated', this.#boundHandler);
            console.log('💩 [COUNTER] Added listener:', { 
                success: result,
                handler: this.#boundHandler.name || 'anonymous'
            });
            
            this.log(LogLevel.SUCCESS, '✅ Counter manager initialized');
            return true;
        } catch (error) {
            console.log('💩 [COUNTER] Initialization error:', error);
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Handle counter data updates and reflect in UI
     * @param {Object} counts Counter values
     */
    async handleDataUpdate(counts) {
        try {
            console.log('💩 [COUNTER] Received counts update:', counts);

            if (!counts || typeof counts !== 'object') {
                console.log('💩 [COUNTER] Invalid counts received');
                throw new Error('Invalid counter data received');
            }

            // Map API statuses to HTML data-status attributes
            const statusMap = {
                '1': '1',
                '2': '2', 
                '3': '3',
                'ready': 'ready',
                'overdue': 'overdue'
            };

            // Update each counter in the UI
            Object.entries(counts).forEach(([status, count]) => {
                const mappedStatus = statusMap[status];
                if (!mappedStatus) {
                    console.log('💩 [COUNTER] Unknown status:', status);
                    return;
                }

                console.log('💩 [COUNTER] Updating counter:', { 
                    originalStatus: status,
                    mappedStatus,
                    count 
                });
                
                // Find element by data-status and lead-count
                const container = document.querySelector(`[data-status="${mappedStatus}"]`);
                if (!container) {
                    console.log('💩 [COUNTER] Container not found:', mappedStatus);
                    return;
                }

                // Find the counter element within container
                const element = container.querySelector('.lead-count');
                if (!element) {
                    console.log('💩 [COUNTER] Counter element not found in container:', mappedStatus);
                    return;
                }

                console.log('💩 [COUNTER] Found elements for status:', {
                    status: mappedStatus,
                    container: container.outerHTML,
                    element: element.outerHTML
                });

                // Update text and classes
                element.textContent = count;
                element.classList.toggle('count-zero', count === 0);
                element.classList.add('count-updated');
                setTimeout(() => element.classList.remove('count-updated'), 1000);

                // Update ID-based counter if exists
                const idCounter = document.getElementById(`count-${mappedStatus.toLowerCase()}`);
                if (idCounter) {
                    console.log('💩 [COUNTER] Updating ID-based counter:', {
                        status: mappedStatus,
                        element: idCounter.outerHTML
                    });
                    idCounter.textContent = count;
                    idCounter.classList.toggle('count-zero', count === 0);
                }
            });

            // Update total count if element exists
            const totalElement = document.querySelector('#total-count');
            if (totalElement) {
                const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
                console.log('💩 [COUNTER] Updating total count:', {
                    total,
                    element: totalElement.outerHTML
                });
                totalElement.textContent = total;
                totalElement.classList.add('count-updated');
                setTimeout(() => totalElement.classList.remove('count-updated'), 1000);
            }

            console.log('💩 [COUNTER] All counters updated successfully');
        } catch (error) {
            console.log('💩 [COUNTER] Error updating counters:', error);
            this.handleError(error, ErrorType.UI_UPDATE, ErrorSeverity.MEDIUM);
            
            // Show error state in UI
            document.querySelectorAll('.lead-count').forEach(counter => {
                counter.textContent = '-';
                counter.classList.add('count-error');
            });
        }
    }

    async dispose() {
        try {
            const eventManager = await this.getDependency('event');
            console.log('💩 [COUNTER] Removing listener');
            await eventManager.off('counters:updated', this.#boundHandler);
            console.log('💩 [COUNTER] Listener removed');
            await super.dispose();
        } catch (error) {
            console.log('💩 [COUNTER] Error during dispose:', error);
            throw error;
        }
    }
}

export { CounterManager };
export const counterManager = CounterManager.getInstance();