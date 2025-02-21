import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';

/**
 * Alarm names constants
 */
export const ALARM_NAMES = {
    CHECK_NOTIFICATIONS: 'checkNotifications',
    FETCH_DATA: 'fetchData',
    CHECK_ORDERS: 'checkOrders',
    CHECK_NEW_ORDERS: 'checkNewOrders'
};

/**
 * Alarm intervals in minutes
 */
export const ALARM_INTERVALS = {
    [ALARM_NAMES.CHECK_NOTIFICATIONS]: 5,  // every 5 minutes
    [ALARM_NAMES.FETCH_DATA]: 15,          // every 15 minutes
    [ALARM_NAMES.CHECK_ORDERS]: 5,         // every 5 minutes
    [ALARM_NAMES.CHECK_NEW_ORDERS]: 1      // every minute
};

/**
 * Alarm configuration
 */
export const ALARM_CONFIG = {
    MAX_INIT_ATTEMPTS: 3,
    INIT_DELAY: 1000,
    RETRY_DELAY: 2000,
    DEFAULT_INTERVAL: 5,
    CLEANUP_INTERVAL: 60000,
    STORAGE_KEY: 'alarms'
};

/**
 * Manages Chrome extension alarms
 * @extends {BaseManager}
 */
class AlarmManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;
    
    /** @private */
    #alarms = new Map();
    /** @private */
    #intervals = new Map();
    /** @private */
    #lastCheck = 0;
    
    /** @private */
    #isInitialized = false;
    
    /** @private */
    #initAttempts = 0;

    /** @private */
    #pendingAlarms = new Map();

    /** @private */
    #processingInterval = null;

    /** @private */
    #alarmQueue = [];

    /** @private */
    #isProcessing = false;

    /** @private */
    #isReady = false;

    /** @private */
    #cleanupInterval = null;

    /** @private */
    #eventManager = null;

    /** @private */
    #orderManager = null;

    /** @private */
    #storageManager = null;

    // Private method declarations
    // #processAlarmQueue = undefined;
    // #startAlarmProcessor = undefined;
    // #processPendingAlarms = undefined;
    // #createDefaultAlarms = undefined;

    constructor(registry) {
        if (AlarmManager.#instance) {
            return AlarmManager.#instance;
        }
        super(registry, 'alarm');
        AlarmManager.#instance = this;
        AlarmManager._registry = registry;
        
        // Add dependencies
        this.addDependency('event');
        this.addDependency('order');
        this.addDependency('storage');
    }

    static getInstance() {
        if (!AlarmManager.#instance && AlarmManager._registry) {
            AlarmManager.#instance = new AlarmManager(AlarmManager._registry);
        }
        return AlarmManager.#instance;
    }

    static setRegistry(registry) {
        AlarmManager._registry = registry;
    }

    /**
     * Handle alarm event
     * @private
     */
    #handleAlarm = async (alarm) => {
        try {
            if (!this.#isReady) {
                this.log(LogLevel.INFO, `⏳ Queuing alarm ${alarm.name} - system not ready`);
                this.#alarmQueue.push(alarm);
                return;
            }

            // Get required managers
            const eventManager = await this.getDependency('event');
            const orderManager = await this.getDependency('order');
            
            if (!eventManager?.isInitialized() || !orderManager?.isInitialized()) {
                this.log(LogLevel.INFO, `⏳ Queuing alarm ${alarm.name} - managers not ready`);
                this.#alarmQueue.push(alarm);
                return;
            }

            this.log(LogLevel.DEBUG, `⏰ Processing alarm: ${alarm.name}`);
            await eventManager.emit(`alarm:${alarm.name}`, alarm);
        } catch (error) {
            this.handleError(error, ErrorType.ALARM_HANDLER, ErrorSeverity.MEDIUM, {
                alarmName: alarm.name
            });
        }
    };

    /**
     * Process queued alarms
     * @private
     */
    #processAlarmQueue = async () => {
        if (this.#isProcessing || !this.#isReady) return;
        
        this.#isProcessing = true;
        try {
            while (this.#alarmQueue.length > 0) {
                const alarm = this.#alarmQueue.shift();
                await this.#handleAlarm(alarm);
            }
        } finally {
            this.#isProcessing = false;
        }
    };

    /**
     * Initialize alarm manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing alarm manager...');
            
            // Get required dependencies
            const [eventManager, orderManager, storageManager] = await Promise.all([
                this.getDependency('event'),
                this.getDependency('order'),
                this.getDependency('storage')
            ]);

            // Validate required dependencies
            if (!eventManager?.isInitialized()) {
                throw new Error('EventManager must be initialized');
            }
            if (!orderManager?.isInitialized()) {
                throw new Error('OrderManager must be initialized');
            }
            if (!storageManager?.isInitialized()) {
                throw new Error('StorageManager must be initialized');
            }

            // Store dependencies
            this.#eventManager = eventManager;
            this.#orderManager = orderManager;
            this.#storageManager = storageManager;
            
            // Start cleanup interval
            this.#cleanupInterval = setInterval(() => this.cleanup(), ALARM_CONFIG.CLEANUP_INTERVAL);
            
            // Load existing alarms from storage
            const existingAlarms = await storageManager.get(ALARM_CONFIG.STORAGE_KEY) || [];
            this.#alarms = new Map(existingAlarms.map(alarm => [alarm.id, alarm]));
            
            // Start alarm processor
            this.#startAlarmProcessor();
            
            // Mark as initialized and ready
            this.#isInitialized = true;
            this.#isReady = true;
            
            this.log(LogLevel.SUCCESS, '✅ Alarm manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Start alarm processor
     * @private
     */
    #startAlarmProcessor = () => {
        if (this.#processingInterval) {
            clearInterval(this.#processingInterval);
        }

        this.#processingInterval = setInterval(() => {
            this.#processPendingAlarms().catch(error => {
                this.handleError(error, ErrorType.ALARM_PROCESSOR, ErrorSeverity.MEDIUM);
            });
        }, 1000); // Process pending alarms every second
    };

    /**
     * Process pending alarms
     * @private
     */
    #processPendingAlarms = async () => {
        if (!this.isReady() || this.#pendingAlarms.size === 0) {
            return;
        }

        const now = Date.now();
        const eventManager = await this.getDependency('event');

        for (const [alarmName, { timestamp, retryCount }] of this.#pendingAlarms.entries()) {
            // Skip if not ready to retry
            if (now - timestamp < getRetryDelay(retryCount)) {
                continue;
            }

            try {
                await eventManager.emit(`alarm:${alarmName}`, { 
                    name: alarmName,
                    retryCount
                });
                this.#pendingAlarms.delete(alarmName);
            } catch (error) {
                // Increment retry count or remove if max retries reached
                if (retryCount >= MAX_RETRY_ATTEMPTS) {
                    this.#pendingAlarms.delete(alarmName);
                    this.handleError(error, ErrorType.ALARM_MAX_RETRIES, ErrorSeverity.HIGH, {
                        alarm: alarmName
                    });
                } else {
                    this.#pendingAlarms.set(alarmName, {
                        timestamp: now,
                        retryCount: retryCount + 1
                    });
                }
            }
        }
    };

    /**
     * Create default alarms
     * @private
     */
    #createDefaultAlarms = async () => {
        try {
            await Promise.all([
                this.createAlarm(ALARM_NAMES.CHECK_NOTIFICATIONS, {
                    periodInMinutes: ALARM_INTERVALS[ALARM_NAMES.CHECK_NOTIFICATIONS]
                }),
                this.createAlarm(ALARM_NAMES.FETCH_DATA, {
                    periodInMinutes: ALARM_INTERVALS[ALARM_NAMES.FETCH_DATA]
                }),
                this.createAlarm(ALARM_NAMES.CHECK_ORDERS, {
                    periodInMinutes: ALARM_INTERVALS[ALARM_NAMES.CHECK_ORDERS]
                }),
                this.createAlarm(ALARM_NAMES.CHECK_NEW_ORDERS, {
                    periodInMinutes: ALARM_INTERVALS[ALARM_NAMES.CHECK_NEW_ORDERS]
                })
            ]);
        } catch (error) {
            this.handleError(error, ErrorType.ALARM_CREATION, ErrorSeverity.HIGH);
        }
    };

    /**
     * Create a new alarm
     * @param {string} name Alarm name
     * @param {Object} settings Alarm settings
     * @returns {Promise<void>}
     */
    async createAlarm(name, settings = {}) {
        try {
            const { periodInMinutes = ALARM_CONFIG.DEFAULT_INTERVAL } = settings;
            
            // Create interval
            const interval = setInterval(async () => {
                try {
                    await this.#handleAlarm({ name });
                } catch (error) {
                    this.handleError(error, ErrorType.ALARM_HANDLER, ErrorSeverity.MEDIUM, {
                        alarmName: name
                    });
                }
            }, periodInMinutes * 60 * 1000);
            
            // Store interval
            this.#intervals.set(name, interval);
            
            // Store alarm settings
            this.#alarms.set(name, settings);
            
            // Save to storage
            await this.#storageManager.set(ALARM_CONFIG.STORAGE_KEY, Array.from(this.#alarms.entries()));
            
            this.log(LogLevel.INFO, '⏰ Created alarm', {
                name,
                periodInMinutes
            });
        } catch (error) {
            this.handleError(error, ErrorType.ALARM_CREATE, ErrorSeverity.MEDIUM, {
                method: 'createAlarm',
                alarmName: name,
                settings
            });
            throw error;
        }
    }

    /**
     * Clear an alarm
     * @param {string} name Alarm name
     * @returns {Promise<void>}
     */
    async clearAlarm(name) {
        try {
            // Clear interval
            const interval = this.#intervals.get(name);
            if (interval) {
                clearInterval(interval);
                this.#intervals.delete(name);
            }
            
            // Remove alarm settings
            this.#alarms.delete(name);
            
            // Save to storage
            await this.#storageManager.set(ALARM_CONFIG.STORAGE_KEY, Array.from(this.#alarms.entries()));
            
            this.log(LogLevel.INFO, '🗑️ Cleared alarm', { name });
        } catch (error) {
            this.handleError(error, ErrorType.ALARM_CLEAR, ErrorSeverity.LOW, {
                method: 'clearAlarm',
                alarmName: name
            });
            throw error;
        }
    }

    /**
     * Clear all alarms
     * @returns {Promise<void>}
     */
    async clearAll() {
        try {
            // Clear all intervals
            for (const interval of this.#intervals.values()) {
                clearInterval(interval);
            }
            this.#intervals.clear();
            
            // Clear all alarms
            this.#alarms.clear();
            
            // Save to storage
            await this.#storageManager.set(ALARM_CONFIG.STORAGE_KEY, []);
            
            this.log(LogLevel.INFO, '🗑️ Cleared all alarms');
        } catch (error) {
            this.handleError(error, ErrorType.ALARM_CLEAR_ALL, ErrorSeverity.MEDIUM, {
                method: 'clearAll'
            });
            throw error;
        }
    }

    /**
     * Get an alarm
     * @param {string} name Alarm name
     * @returns {Promise<Object>}
     */
    async getAlarm(name) {
        try {
            return this.#alarms.get(name);
        } catch (error) {
            this.handleError(error, ErrorType.ALARM_GET, ErrorSeverity.LOW, {
                method: 'getAlarm',
                alarmName: name
            });
            throw error;
        }
    }

    /**
     * Get all alarms
     * @returns {Promise<Object[]>}
     */
    async getAllAlarms() {
        try {
            return Array.from(this.#alarms.entries()).map(([name, settings]) => ({
                name,
                ...settings
            }));
        } catch (error) {
            this.handleError(error, ErrorType.ALARM_GET_ALL, ErrorSeverity.LOW, {
                method: 'getAllAlarms'
            });
            throw error;
        }
    }

    /**
     * Check if manager is ready
     * @returns {boolean}
     */
    isReady() {
        return this.#isReady;
    }

    /**
     * Check if manager is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.#isInitialized;
    }

    /**
     * Clean up resources
     */
    async dispose() {
        try {
            // Stop alarm processor
            if (this.#processingInterval) {
                clearInterval(this.#processingInterval);
                this.#processingInterval = null;
            }
            
            // Clear all alarms and state
            await this.clearAll();
            this.#pendingAlarms.clear();
            this.#alarms.clear();
            
            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
        }
    }

    /**
     * Clean up alarms and intervals
     * @private
     */
    cleanup() {
        try {
            // Clear all intervals
            for (const interval of this.#intervals.values()) {
                clearInterval(interval);
            }
            this.#intervals.clear();

            // Clear all alarms
            this.#alarms.clear();
            this.#lastCheck = 0;

            this.log(LogLevel.INFO, '🧹 Alarm cleanup completed');
        } catch (error) {
            this.handleError(error, ErrorType.CLEANUP, ErrorSeverity.LOW, {
                method: 'cleanup'
            });
        }
    }
}

// Export both class and instance
export { AlarmManager };
export const alarmManager = AlarmManager.getInstance(); 