import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';

const ALARM_NAMES = {
    CHECK_NOTIFICATIONS: 'checkNotifications',
    FETCH_DATA: 'fetchData',
    CHECK_ORDERS: 'checkOrders',
    CHECK_NEW_ORDERS: 'checkNewOrders'
};

const ALARM_INTERVALS = {
    [ALARM_NAMES.CHECK_NOTIFICATIONS]: 5,  // co 5 minut
    [ALARM_NAMES.FETCH_DATA]: 15,          // co 15 minut
    [ALARM_NAMES.CHECK_ORDERS]: 5,         // co 5 minut
    [ALARM_NAMES.CHECK_NEW_ORDERS]: 1      // co minutę
};

const ALARM_CONFIG = {
    MAX_INIT_ATTEMPTS: 3,
    INIT_DELAY: 1000,
    RETRY_DELAY: 2000,
    DEFAULT_INTERVAL: 5
};

/**
 * Manages Chrome extension alarms
 * @extends {BaseManager}
 */
export class AlarmManager extends BaseManager {
    static #instance = null;
    #handlers = new Map();
    #fallbackTimers = new Map();
    #isInitialized = false;

    constructor() {
        if (AlarmManager.#instance) {
            return AlarmManager.#instance;
        }
        super('AlarmManager');
        AlarmManager.#instance = this;
    }

    static getInstance() {
        if (!AlarmManager.#instance) {
            AlarmManager.#instance = new AlarmManager();
        }
        return AlarmManager.#instance;
    }

    /**
     * Register alarm handler
     * @param {string} alarmName - Name of the alarm
     * @param {Function} handler - Handler function
     */
    registerHandler(alarmName, handler) {
        this.#handlers.set(alarmName, handler);
        this.log(LogLevel.DEBUG, `📌 Registered handler for alarm: ${alarmName}`);
    }

    /**
     * Initialize alarm manager
     * @returns {Promise<void>}
     */
    async onInitialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing alarm manager...');

            // Register default handlers
            this.registerHandler('checkNotifications', async () => {
                await this.eventManager?.emit('notification:check');
            });

            this.registerHandler('fetchData', async () => {
                await this.eventManager?.emit('data:fetch');
            });

            this.registerHandler('checkOrders', async () => {
                await this.eventManager?.emit('orders:check');
            });

            this.registerHandler('checkNewOrders', async () => {
                await this.eventManager?.emit('orders:check-new');
            });

            // Setup alarm listeners
            if (chrome?.alarms) {
                chrome.alarms.onAlarm.addListener(this.#handleAlarm.bind(this));
                this.log(LogLevel.INFO, '✅ Chrome alarms API initialized');
            } else {
                this.log(LogLevel.WARNING, '⚠️ Chrome alarms API not available, using fallback mode');
                this.#setupFallbackTimers();
            }

            this.#isInitialized = true;
            this.log(LogLevel.INFO, '✅ Alarm manager initialized');
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Failed to initialize alarm manager:', error);
            throw error;
        }
    }

    /**
     * Handle alarm event
     * @param {chrome.alarms.Alarm} alarm - Alarm object
     * @private
     */
    async #handleAlarm(alarm) {
        try {
            const handler = this.#handlers.get(alarm.name);
            if (handler) {
                this.log(LogLevel.DEBUG, `⏰ Received alarm: ${alarm.name}`);
                await handler(alarm);
            } else {
                this.log(LogLevel.WARNING, `⚠️ No handler registered for alarm: ${alarm.name}`);
            }
        } catch (error) {
            this.log(LogLevel.ERROR, `❌ Error handling alarm ${alarm.name}:`, error);
            this.errorHandler?.handleError(error, ErrorType.ALARM, ErrorSeverity.MEDIUM);
        }
    }

    /**
     * Setup fallback timers when Chrome alarms API is not available
     * @private
     */
    #setupFallbackTimers() {
        const intervals = {
            checkNotifications: 5 * 60 * 1000,  // 5 minutes
            fetchData: 15 * 60 * 1000,         // 15 minutes
            checkOrders: 5 * 60 * 1000,        // 5 minutes
            checkNewOrders: 60 * 1000          // 1 minute
        };

        for (const [name, interval] of Object.entries(intervals)) {
            const handler = this.#handlers.get(name);
            if (handler) {
                const timerId = setInterval(async () => {
                    try {
                        await handler({ name });
                    } catch (error) {
                        this.log(LogLevel.ERROR, `❌ Error in fallback timer for ${name}:`, error);
                    }
                }, interval);
                this.#fallbackTimers.set(name, timerId);
            }
        }

        this.log(LogLevel.INFO, '✅ Fallback timers setup completed');
    }

    /**
     * Clean up resources
     */
    async dispose() {
        try {
            // Clear all fallback timers
            for (const timerId of this.#fallbackTimers.values()) {
                clearInterval(timerId);
            }
            this.#fallbackTimers.clear();

            // Clear all handlers
            this.#handlers.clear();

            await super.dispose();
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Error disposing alarm manager:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const alarmManager = AlarmManager.getInstance(); 