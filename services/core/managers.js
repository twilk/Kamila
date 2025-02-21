import { ErrorHandler } from './ErrorHandler.js';
import { EventManager } from './EventManager.js';
import { InitialLoadingManager } from './LoadingManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { CacheManager } from './CacheManager.js';
import { UIManager } from './UIManager.js';
import { ThemeManager } from './ThemeManager.js';
import { MenuManager } from './MenuManager.js';
import { NotificationManager } from './NotificationManager.js';
import { DebugManager } from './DebugManager.js';
import { VolumeManager } from './VolumeManager.js';
import { UpdateManager } from './UpdateManager.js';
import { RefreshManager } from './RefreshManager.js';
import { DataManager } from './DataManager.js';
import { StoreManager } from './StoreManager.js';
import { StatusManager } from './StatusManager.js';
import { UserManager } from './UserManager.js';
import { LanguageManager } from './LanguageManager.js';
import { SettingsManager } from './SettingsManager.js';
import { MessageManager } from './MessageManager.js';
import { OperationProgressManager } from './OperationProgressManager.js';
import { dependencyValidator } from './DependencyValidator.js';
import { InterfaceManager } from './InterfaceManager.js';
import { AlarmManager } from './AlarmManager.js';
import { CounterManager } from './CounterManager.js';
import { LogManager } from './LogManager.js';
import { StorageManager } from './StorageManager.js';
import { OrderService } from '../api/OrderService.js';
import { OrderManager } from './OrderManager.js';
import { LogLevel } from './LogLevel.js';
import { APIManager } from './APIManager.js';

/**
 * Central registry for all managers
 */
export class ManagerRegistry {
    /** @type {ManagerRegistry} */
    static #instance = null;
    
    /** @type {Map<string, Function>} */
    #managerClasses = new Map();

    /** @type {Map<string, Object>} */
    #managers = new Map();

    /** @type {Object} */
    #metrics = {
        registrations: new Map(),
        accesses: new Map(),
        errors: new Map(),
        initializationTimes: new Map()
    };

    /** @type {string[]} */
    #criticalManagers = ['error', 'log', 'event', 'storage', 'store', 'api', 'data', 'status'];

    /** @type {boolean} */
    #isInitializing = false;

    constructor() {
        if (ManagerRegistry.#instance) {
            return ManagerRegistry.#instance;
        }
        ManagerRegistry.#instance = this;
    }

    /**
     * Get singleton instance
     * @returns {ManagerRegistry}
     */
    static getInstance() {
        if (!ManagerRegistry.#instance) {
            ManagerRegistry.#instance = new ManagerRegistry();
        }
        return ManagerRegistry.#instance;
    }

    /**
     * Register a manager class
     * @param {string} name Manager name
     * @param {Function} ManagerClass Manager class
     */
    register(name, ManagerClass) {
        try {
            console.log(`🔄 Registering manager: ${name}`);
            
            if (!name || typeof name !== 'string') {
                throw new Error('Manager name must be a non-empty string');
            }
            name = name.toLowerCase();

            if (this.#managerClasses.has(name)) {
                throw new Error(`Manager "${name}" already registered`);
            }

            if (typeof ManagerClass !== 'function') {
                throw new Error('ManagerClass must be a constructor');
            }

            this.#managerClasses.set(name, ManagerClass);
            this.#recordMetric('registration', name);
            console.log(`✅ Registered manager: ${name}`);
        } catch (error) {
            console.error(`❌ Failed to register manager: ${name}`, error);
            throw error;
        }
    }

    /**
     * Get a manager instance
     * @param {string} name Manager name
     * @returns {Promise<Object>} Manager instance
     */
    async get(name) {
        try {
            console.log(`🔄 Getting manager: ${name}`);
            
            if (!name || typeof name !== 'string') {
                throw new Error('Manager name must be a non-empty string');
            }
            name = name.toLowerCase();

            const startTime = Date.now();
            
            if (!this.#managers.has(name)) {
                console.log(`🔄 Creating new instance of ${name}`);
                const ManagerClass = this.#managerClasses.get(name);
                if (!ManagerClass) {
                    throw new Error(`Manager ${name} not found`);
                }

                // Create new instance
                const instance = typeof ManagerClass === 'function' ? 
                    (ManagerClass.prototype?.constructor ? new ManagerClass(this) : ManagerClass(this)) :
                    null;
                    
                if (!instance) {
                    throw new Error(`Failed to create instance of ${name}`);
                }
                
                this.#managers.set(name, instance);
            }

            const instance = this.#managers.get(name);
            this.#recordMetric('access', name, Date.now() - startTime);
            console.log(`✅ Got manager: ${name}`);
            return instance;
        } catch (error) {
            console.error(`❌ Failed to get manager: ${name}`, error);
            this.#managers.delete(name);
            this.#recordMetric('error', name, error);
            throw error;
        }
    }

    /**
     * Initialize all managers
     * @returns {Promise<boolean>}
     */
    async initializeAll() {
        if (this.#isInitializing) {
            throw new Error('Initialization already in progress');
        }

        this.#isInitializing = true;
        const startTime = Date.now();
        const failedManagers = new Set();

        try {
            console.log('🔄 Initializing critical managers...');
            
            // Initialize error handler first as it's needed by everything
            const errorManager = await this.get('error');
            if (errorManager && !errorManager.isInitialized()) {
                await errorManager.initialize();
                this.#metrics.initializationTimes.set('error', Date.now() - startTime);
                console.log(`  ✅ Initialized error in ${Date.now() - startTime}ms`);
            }

            // Then initialize log and event as they're needed by most things
            for (const name of ['log', 'event']) {
                try {
                    console.log(`  ⚡ Initializing critical manager: ${name}`);
                    const manager = await this.get(name);
                    if (!manager?.isInitialized()) {
                        await manager.initialize();
                    }
                    this.#metrics.initializationTimes.set(name, Date.now() - startTime);
                    console.log(`  ✅ Initialized ${name} in ${Date.now() - startTime}ms`);
                } catch (error) {
                    console.error(`  ❌ Failed to initialize ${name}:`, error);
                    failedManagers.add(name);
                }
            }

            // Then initialize storage as it's needed by many managers
            try {
                console.log(`  ⚡ Initializing critical manager: storage`);
                const storageManager = await this.get('storage');
                if (!storageManager?.isInitialized()) {
                    await storageManager.initialize();
                }
                this.#metrics.initializationTimes.set('storage', Date.now() - startTime);
                console.log(`  ✅ Initialized storage in ${Date.now() - startTime}ms`);
            } catch (error) {
                console.error(`  ❌ Failed to initialize storage:`, error);
                failedManagers.add('storage');
            }

            // Then initialize store, api, data, and status as they're core services
            for (const name of ['store', 'api', 'data', 'status']) {
                try {
                    console.log(`  ⚡ Initializing critical manager: ${name}`);
                    const manager = await this.get(name);
                    if (!manager?.isInitialized()) {
                        await manager.initialize();
                    }
                    this.#metrics.initializationTimes.set(name, Date.now() - startTime);
                    console.log(`  ✅ Initialized ${name} in ${Date.now() - startTime}ms`);
                } catch (error) {
                    console.error(`  ❌ Failed to initialize ${name}:`, error);
                    failedManagers.add(name);
                }
            }

            console.log('🔄 Initializing remaining managers...');
            
            // Initialize remaining managers
            for (const [name, ManagerClass] of this.#managerClasses.entries()) {
                if (['error', 'log', 'event', 'storage', 'store', 'api', 'data', 'status'].includes(name)) continue;
                
                try {
                    console.log(`  ⚡ Initializing manager: ${name}`);
                    const manager = await this.get(name);
                    if (!manager?.isInitialized()) {
                        await manager.initialize();
                        this.#metrics.initializationTimes.set(name, Date.now() - startTime);
                        console.log(`  ✅ Initialized ${name} in ${Date.now() - startTime}ms`);
                    }
                } catch (error) {
                    console.error(`  ❌ Failed to initialize ${name}:`, error);
                    failedManagers.add(name);
                }
            }

            const totalTime = Date.now() - startTime;
            
            if (failedManagers.size > 0) {
                console.error(`❌ Manager initialization failed after ${totalTime}ms:`, 
                    Array.from(failedManagers).join(', '));
            } else {
                console.log(`✅ All managers initialized in ${totalTime}ms`);
            }

            return failedManagers.size === 0;
        } finally {
            this.#isInitializing = false;
        }
    }

    /**
     * Reset registry state
     */
    reset() {
        for (const [name, manager] of this.#managers) {
            try {
                manager.dispose();
            } catch (error) {
                this.#recordMetric('error', `dispose_${name}`, 0, error);
            }
        }
        this.#managers.clear();
        this.#metrics = {
            registrations: new Map(),
            accesses: new Map(),
            errors: new Map(),
            initializationTimes: new Map()
        };
    }

    /**
     * Get registry status
     * @returns {Object} Registry status
     */
    getStatus() {
        const managerStates = {};
        for (const [name, manager] of this.#managers) {
            managerStates[name] = {
                initialized: manager.isInitialized(),
                ready: manager.isReady(),
                error: manager.getLastError()?.message
            };
        }

        return {
            registeredCount: this.#managerClasses.size,
            instanceCount: this.#managers.size,
            managerStates
        };
    }

    /**
     * Get registry metrics
     * @returns {Object} Registry metrics
     */
    getMetrics() {
        return {
            registrations: Object.fromEntries(this.#metrics.registrations),
            accesses: Object.fromEntries(this.#metrics.accesses),
            errors: Object.fromEntries(this.#metrics.errors),
            initializationTimes: Object.fromEntries(this.#metrics.initializationTimes)
        };
    }

    /**
     * Record a metric
     * @private
     */
    #recordMetric(type, name, duration = 0, error = null) {
        const metrics = this.#metrics[type];
        if (!metrics) return;

        const existing = metrics.get(name) || { count: 0, totalTime: 0, errors: [] };
        existing.count++;
        existing.totalTime += duration;

        if (error) {
            existing.errors.push({
                timestamp: Date.now(),
                message: error.message
            });
        }

        metrics.set(name, existing);
    }

    /**
     * Get initialization status report
     * @returns {Object} Report of manager initialization status
     */
    getInitializationReport() {
        const report = {
            registered: [],
            initialized: [],
            failed: [],
            pending: [],
            dependencies: {}
        };

        // Check all registered managers
        for (const [name, ManagerClass] of this.#managerClasses.entries()) {
            report.registered.push(name);
            
            const instance = this.#managers.get(name);
            if (!instance) {
                report.pending.push(name);
                continue;
            }

            if (instance.isInitialized()) {
                report.initialized.push(name);
            } else {
                report.failed.push(name);
            }

            // Get dependencies
            if (instance.getDependencies) {
                report.dependencies[name] = instance.getDependencies();
            }
        }

        // Add metrics
        report.metrics = {
            registrationTime: Object.fromEntries(this.#metrics.registrations),
            accessTime: Object.fromEntries(this.#metrics.accesses),
            errors: Object.fromEntries(this.#metrics.errors),
            initTime: Object.fromEntries(this.#metrics.initializationTimes)
        };

        return report;
    }

    /**
     * Print initialization report
     */
    printInitializationReport() {
        const report = this.getInitializationReport();
        
        console.group('📊 Manager Initialization Report');
        
        console.log('✅ Initialized:', report.initialized.length);
        console.log(report.initialized.join(', '));
        
        console.log('\n❌ Failed:', report.failed.length);
        console.log(report.failed.join(', '));
        
        console.log('\n⏳ Pending:', report.pending.length);
        console.log(report.pending.join(', '));
        
        console.log('\n🔄 Dependencies:');
        Object.entries(report.dependencies).forEach(([manager, deps]) => {
            if (deps.length > 0) {
                console.log(`${manager}: ${deps.join(', ')}`);
            }
        });
        
        if (report.failed.length > 0) {
            console.log('\n❌ Initialization Errors:');
            report.failed.forEach(name => {
                const errors = report.metrics.errors[name];
                if (errors?.length > 0) {
                    console.log(`${name}:`, errors[errors.length - 1].message);
                }
            });
        }
        
        console.groupEnd();
        
        return report;
    }
}

// Create singleton instance
const registry = ManagerRegistry.getInstance();

// Export registry instance, class and get function
export { registry };
export const getManager = (name) => registry.get(name);

// Export manager getters
export const getErrorHandler = () => getManager('error');
export const getEventManager = () => getManager('event');
export const getLogManager = () => getManager('log');
export const getStorageManager = () => getManager('storage');
export const getInitialLoadingManager = () => getManager('loading');
export const getConnectionManager = () => getManager('connection');
export const getCacheManager = () => getManager('cache');
export const getUIManager = () => getManager('ui');
export const getThemeManager = () => getManager('theme');
export const getMenuManager = () => getManager('menu');
export const getNotificationManager = () => getManager('notification');
export const getDebugManager = () => getManager('debug');
export const getVolumeManager = () => getManager('volume');
export const getUpdateManager = () => getManager('update');
export const getRefreshManager = () => getManager('refresh');
export const getDataManager = () => getManager('data');
export const getStoreManager = () => getManager('store');
export const getStatusManager = () => getManager('status');
export const getUserManager = () => getManager('user');
export const getLanguageManager = () => getManager('language');
export const getSettingsManager = () => getManager('settings');
export const getMessageManager = () => getManager('message');
export const getOperationProgressManager = () => getManager('progress');
export const getInterfaceManager = () => getManager('interface');
export const getAlarmManager = () => getManager('alarm');
export const getCounterManager = () => getManager('counter');
export const getOrderManager = () => getManager('order');
export const getAPIManager = () => getManager('api');