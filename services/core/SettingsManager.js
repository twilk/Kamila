import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { storageManager } from './StorageManager.js';
import { EventManager } from './EventManager.js';
import { refreshManager } from './RefreshManager.js';
import { alarmManager } from './AlarmManager.js';
import { notificationManager } from './NotificationManager.js';
import { languageManager } from './LanguageManager.js';

// Dodaj stałą dla wersji ustawień
const SETTINGS_VERSION = '1.0.0';

// Dodaj stałą dla klucza w storage
const STORAGE_KEY = 'app_settings';

// Stałe dla kluczy ustawień
const SETTINGS_KEYS = {
    THEME: 'theme',
    LANGUAGE: 'language',
    NOTIFICATIONS: 'notifications',
    REFRESH_INTERVAL: 'refreshInterval',
    DEBUG_MODE: 'debugMode',
    STORE_ID: 'storeId',
    ALARM_INTERVALS: 'alarmIntervals',
    UI_CONFIG: 'uiConfig',
    CACHE_CONFIG: 'cacheConfig'
};

// Domyślne wartości ustawień
const DEFAULT_SETTINGS = {
    [SETTINGS_KEYS.THEME]: 'light',
    [SETTINGS_KEYS.LANGUAGE]: 'pl',
    [SETTINGS_KEYS.NOTIFICATIONS]: {
        enabled: true,
        sound: true,
        desktop: true,
        limits: {
            perMinute: 10,
            perHour: 30,
            perDay: 100
        }
    },
    [SETTINGS_KEYS.REFRESH_INTERVAL]: 5 * 60 * 1000, // 5 minut
    [SETTINGS_KEYS.DEBUG_MODE]: false,
    [SETTINGS_KEYS.STORE_ID]: 'ALL',
    [SETTINGS_KEYS.ALARM_INTERVALS]: {
        checkNotifications: 5,
        fetchData: 15,
        checkOrders: 5,
        checkNewOrders: 1
    },
    [SETTINGS_KEYS.UI_CONFIG]: {
        compactMode: false,
        showCounts: true,
        enableAnimations: true
    },
    [SETTINGS_KEYS.CACHE_CONFIG]: {
        enabled: true,
        ttl: 5 * 60 * 1000, // 5 minut
        maxSize: 50 * 1024 * 1024 // 50MB
    }
};

// Walidatory dla ustawień
const SETTINGS_VALIDATORS = {
    [SETTINGS_KEYS.THEME]: (value) => ['light', 'dark', 'system'].includes(value),
    [SETTINGS_KEYS.LANGUAGE]: (value) => typeof value === 'string' && value.length === 2,
    [SETTINGS_KEYS.NOTIFICATIONS]: (value) => {
        return typeof value === 'object' &&
            typeof value.enabled === 'boolean' &&
            typeof value.sound === 'boolean' &&
            typeof value.desktop === 'boolean' &&
            typeof value.limits === 'object' &&
            typeof value.limits.perMinute === 'number' &&
            typeof value.limits.perHour === 'number' &&
            typeof value.limits.perDay === 'number';
    },
    [SETTINGS_KEYS.REFRESH_INTERVAL]: (value) => typeof value === 'number' && value >= 1000,
    [SETTINGS_KEYS.DEBUG_MODE]: (value) => typeof value === 'boolean',
    [SETTINGS_KEYS.STORE_ID]: (value) => typeof value === 'string',
    [SETTINGS_KEYS.ALARM_INTERVALS]: (value) => {
        return typeof value === 'object' &&
            typeof value.checkNotifications === 'number' &&
            typeof value.fetchData === 'number' &&
            typeof value.checkOrders === 'number' &&
            typeof value.checkNewOrders === 'number';
    },
    [SETTINGS_KEYS.UI_CONFIG]: (value) => {
        return typeof value === 'object' &&
            typeof value.compactMode === 'boolean' &&
            typeof value.showCounts === 'boolean' &&
            typeof value.enableAnimations === 'boolean';
    },
    [SETTINGS_KEYS.CACHE_CONFIG]: (value) => {
        return typeof value === 'object' &&
            typeof value.enabled === 'boolean' &&
            typeof value.ttl === 'number' &&
            typeof value.maxSize === 'number';
    }
};

/**
 * Manages application settings with validation and persistence
 * @extends {BaseManager}
 */
class SettingsManager extends BaseManager {
    static #instance = null;
    #settings = new Map();
    #settingsListeners = new Map();
    #validators = new Map();
    #defaultValues = new Map();
    #initialized = false;
    #version = SETTINGS_VERSION;
    #migrationNeeded = false;
    static _registry = null;
    #storage = null;

    constructor(registry) {
        if (SettingsManager.#instance) {
            return SettingsManager.#instance;
        }
        super(registry, 'SettingsManager');
        SettingsManager.#instance = this;
        SettingsManager._registry = registry;
        
        // Inicjalizacja walidatorów i domyślnych wartości
        Object.entries(SETTINGS_VALIDATORS).forEach(([key, validator]) => {
            this.#validators.set(key, validator);
            this.#defaultValues.set(key, DEFAULT_SETTINGS[key]);
        });
    }

    static getInstance() {
        if (!SettingsManager.#instance && SettingsManager._registry) {
            SettingsManager.#instance = new SettingsManager(SettingsManager._registry);
        }
        return SettingsManager.#instance;
    }

    static setRegistry(registry) {
        SettingsManager._registry = registry;
    }

    /**
     * Initialize settings manager and set up integrations
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing settings manager...');

            // Get storage dependency
            const storage = await this.getDependency('storage');
            if (!storage?.isInitialized()) {
                throw new Error('Storage manager must be initialized');
            }

            // Store storage dependency
            this.#storage = storage;

            // Initialize storage if needed
            if (!this.#storage) {
                throw new Error('Storage dependency not initialized');
            }

            // Load settings from storage
            const storedSettings = await this.#storage.get('settings');
            if (storedSettings) {
                for (const [key, value] of Object.entries(storedSettings)) {
                    this.#settings.set(key, value);
                }
            }

            // Set default values for missing settings
            for (const [key, defaultValue] of this.#defaultValues.entries()) {
                if (!this.#settings.has(key)) {
                    this.#settings.set(key, defaultValue);
                }
            }

            // Save complete settings
            await this.#storage.set('settings', Object.fromEntries(this.#settings));

            this.#initialized = true;
            this.log(LogLevel.SUCCESS, '✅ Settings manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
    }

    /**
     * Set up integrations with other managers
     * @private
     */
    async #setupManagerIntegrations() {
        try {
            // Integracja z RefreshManager
            this.on(SETTINGS_KEYS.REFRESH_INTERVAL, (value) => {
                refreshManager.updateSetting('check_frequency', value);
            });

            // Integracja z AlarmManager
            this.on(SETTINGS_KEYS.ALARM_INTERVALS, (value) => {
                Object.entries(value).forEach(([alarmName, interval]) => {
                    alarmManager.updateAlarmInterval(alarmName, interval);
                });
            });

            // Integracja z NotificationManager
            this.on(SETTINGS_KEYS.NOTIFICATIONS, (value) => {
                notificationManager.updateConfig({
                    enabled: value.enabled,
                    sound: value.sound,
                    desktop: value.desktop,
                    limits: value.limits
                });
            });

            // Integracja z LanguageManager
            this.on(SETTINGS_KEYS.LANGUAGE, (value) => {
                languageManager.setLanguage(value);
            });

            // Integracja z UI (theme)
            this.on(SETTINGS_KEYS.THEME, (value) => {
                document.documentElement.setAttribute('data-theme', value);
                EventManager.emit('theme:changed', { theme: value });
            });

            // Integracja z Debug Mode
            this.on(SETTINGS_KEYS.DEBUG_MODE, (value) => {
                if (value) {
                    this.log(LogLevel.DEBUG, '🐛 Debug mode enabled');
                }
                EventManager.emit('debug:changed', { enabled: value });
            });

            // Integracja z Store ID
            this.on(SETTINGS_KEYS.STORE_ID, (value) => {
                EventManager.emit('store:changed', { storeId: value });
            });

            // Integracja z Cache Config
            this.on(SETTINGS_KEYS.CACHE_CONFIG, (value) => {
                storageManager.updateCacheConfig(value);
            });

            this.log(LogLevel.INFO, '🔗 Manager integrations set up');
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: '#setupManagerIntegrations'
            });
            throw error;
        }
    }

    /**
     * Get setting value
     * @param {string} key Setting key
     * @returns {*} Setting value
     */
    get(key) {
        return this.#settings.get(key) ?? this.#defaultValues.get(key);
    }

    /**
     * Set setting value with validation
     * @param {string} key Setting key
     * @param {*} value Setting value
     * @returns {Promise<boolean>} Success status
     */
    async set(key, value) {
        try {
            // Sprawdź czy klucz jest zdefiniowany
            if (!SETTINGS_KEYS[key]) {
                throw new Error(`Invalid setting key: ${key}`);
            }

            // Walidacja wartości
            const validator = this.#validators.get(key);
            if (validator && !validator(value)) {
                throw new Error(`Invalid value for setting ${key}`);
            }

            // Zapisz wartość
            this.#settings.set(key, value);
            await this.#saveSettings();

            // Emituj zdarzenie zmiany
            this.emit('settings:changed', { key, value });

            // Wywołaj listenery
            const listeners = this.#settingsListeners.get(key) || [];
            listeners.forEach(listener => listener(value));

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.SETTINGS, ErrorSeverity.MEDIUM, {
                method: 'set',
                key,
                value
            });
            return false;
        }
    }

    /**
     * Subscribe to setting changes
     * @param {string} key - Setting key
     * @param {Function} listener - Change listener
     */
    on(key, listener) {
        if (!this.#settingsListeners.has(key)) {
            this.#settingsListeners.set(key, new Set());
        }
        this.#settingsListeners.get(key).add(listener);
        
        this.log(LogLevel.DEBUG, `📌 Added listener for setting: ${key}`);
    }

    /**
     * Load settings from storage
     * @private
     */
    async #loadSettings() {
        try {
            // Pobierz dane ze storage wraz z wersją
            const data = await storageManager.get(STORAGE_KEY);
            
            if (data) {
                const { settings, version } = data;
                
                // Sprawdź czy potrzebna jest migracja
                if (version !== this.#version) {
                    this.log(LogLevel.INFO, `🔄 Settings migration needed (${version} -> ${this.#version})`);
                    this.#migrationNeeded = true;
                }

                // Załaduj i zwaliduj każde ustawienie
                if (settings) {
                    for (const [key, value] of Object.entries(settings)) {
                        if (this.#validateSetting(key, value)) {
                            this.#settings.set(key, value);
                            this.log(LogLevel.DEBUG, `✅ Loaded setting: ${key}`);
                        } else {
                            this.log(LogLevel.WARNING, `⚠️ Invalid setting value for ${key}, using default`);
                            this.#settings.set(key, this.#defaultValues.get(key));
                        }
                    }
                }
            }

            // Sprawdź integralność ustawień
            await this.#ensureSettingsIntegrity();

        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM, {
                method: '#loadSettings'
            });
            // W przypadku błędu, użyj domyślnych wartości
            this.#settings = new Map(this.#defaultValues);
        }
    }

    /**
     * Save settings to storage
     * @private
     */
    async #saveSettings() {
        try {
            await storageManager.set(STORAGE_KEY, {
                settings: Object.fromEntries(this.#settings),
                version: this.#version
            });
            
            this.log(LogLevel.DEBUG, '💾 Settings saved');
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM, {
                method: '#saveSettings'
            });
            throw error;
        }
    }

    /**
     * Ensure all required settings exist with valid values
     * @private
     */
    async #ensureSettingsIntegrity() {
        let hasChanges = false;

        // Sprawdź czy wszystkie wymagane ustawienia istnieją
        for (const [key, defaultValue] of this.#defaultValues.entries()) {
            if (!this.#settings.has(key)) {
                this.#settings.set(key, defaultValue);
                hasChanges = true;
                this.log(LogLevel.INFO, `➕ Added missing setting: ${key}`);
            }
        }

        // Usuń nieznane ustawienia
        for (const [key] of this.#settings) {
            if (!this.#defaultValues.has(key)) {
                this.#settings.delete(key);
                hasChanges = true;
                this.log(LogLevel.INFO, `➖ Removed unknown setting: ${key}`);
            }
        }

        // Jeśli były zmiany, zapisz ustawienia
        if (hasChanges || this.#migrationNeeded) {
            await this.#saveSettings();
            this.#migrationNeeded = false;
        }
    }

    /**
     * Validate single setting
     * @private
     */
    #validateSetting(key, value) {
        const validator = this.#validators.get(key);
        if (!validator) {
            return false;
        }
        try {
            return validator(value);
        } catch {
            return false;
        }
    }

    /**
     * Get settings version
     * @returns {string} Current settings version
     */
    getVersion() {
        return this.#version;
    }

    /**
     * Export settings to JSON
     * @returns {Object} Settings export data
     */
    exportSettings() {
        return {
            settings: Object.fromEntries(this.#settings),
            version: this.#version,
            timestamp: Date.now()
        };
    }

    /**
     * Import settings from JSON
     * @param {Object} data Settings data to import
     * @returns {Promise<boolean>} Success status
     */
    async importSettings(data) {
        try {
            if (!data || !data.settings || !data.version) {
                throw new Error('Invalid settings data format');
            }

            // Tymczasowo zapisz stare ustawienia na wypadek błędu
            const oldSettings = new Map(this.#settings);
            
            // Próba załadowania nowych ustawień
            for (const [key, value] of Object.entries(data.settings)) {
                if (!this.#validateSetting(key, value)) {
                    throw new Error(`Invalid setting value for ${key}`);
                }
                this.#settings.set(key, value);
            }

            // Sprawdź integralność i zapisz
            await this.#ensureSettingsIntegrity();
            
            // Emituj event o imporcie
            this.emit('settings:imported', {
                timestamp: Date.now(),
                version: data.version
            });

            return true;
        } catch (error) {
            // Przywróć stare ustawienia w przypadku błędu
            this.#settings = oldSettings;
            this.handleError(error, ErrorType.SETTINGS, ErrorSeverity.MEDIUM, {
                method: 'importSettings'
            });
            return false;
        }
    }

    /**
     * Reset settings to defaults
     * @returns {Promise<boolean>}
     */
    async resetToDefaults() {
        try {
            this.#settings = new Map(this.#defaultValues);
            await this.#saveSettings();
            
            // Emituj zdarzenie resetu
            this.emit('settings:reset');
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.SETTINGS, ErrorSeverity.MEDIUM, {
                method: 'resetToDefaults'
            });
            return false;
        }
    }

    /**
     * Get all settings
     * @returns {Object} All settings
     */
    getAll() {
        return Object.fromEntries(this.#settings);
    }

    /**
     * Clean up resources
     */
    async dispose() {
        try {
            // Wyczyść listenery
            this.#settingsListeners.clear();
            
            // Zapisz ostatni stan
            await this.#saveSettings();
            
            this.#initialized = false;
            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.MEDIUM, {
                method: 'dispose'
            });
        }
    }
}

// Export both class and instance
export { SETTINGS_KEYS };
export { SettingsManager };
export const settingsManager = SettingsManager.getInstance(); 