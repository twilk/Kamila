import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity, LogLevel } from './EventType.js';
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
export const SETTINGS_KEYS = {
    // Core settings
    THEME: 'theme',
    LANGUAGE: 'language',
    STORE_ID: 'store_id',
    DEBUG_MODE: 'debug_mode',

    // Sound settings
    SOUND: 'sound',

    // UI settings
    UI_CONFIG: 'ui_config',

    // Cache settings
    CACHE_CONFIG: 'cache_config',

    // Refresh settings
    REFRESH: 'refresh',

    // Notification settings
    NOTIFICATIONS: 'notifications',

    // User settings
    USER: 'user'
};

// Domyślne wartości ustawień
const DEFAULT_SETTINGS = {
    [SETTINGS_KEYS.THEME]: 'light',
    [SETTINGS_KEYS.LANGUAGE]: 'polish',
    [SETTINGS_KEYS.STORE_ID]: 'ALL',
    [SETTINGS_KEYS.DEBUG_MODE]: false,
    
    [SETTINGS_KEYS.SOUND]: {
        enabled: true,
        url: '',
        volume: 100
    },
    
    [SETTINGS_KEYS.UI_CONFIG]: {
        compactMode: false,
        showCounts: true,
        enableAnimations: true,
        lastOpenTab: 'status'
    },
    
    [SETTINGS_KEYS.CACHE_CONFIG]: {
        enabled: true,
        ttl: 5 * 60 * 1000,
        maxSize: 50 * 1024 * 1024
    },
    
    [SETTINGS_KEYS.REFRESH]: {
        check_frequency: '5m',
        notification_interval: '15m',
        full_refresh: '24h',
        data_freshness: '5m'
    },
    
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
    
    [SETTINGS_KEYS.USER]: {
        id: null,
        preferences: {
            showTutorial: true,
            showDebugPanel: false
        }
    }
};

// Walidatory dla ustawień
const SETTINGS_VALIDATORS = {
    [SETTINGS_KEYS.THEME]: (value) => ['light', 'dark'].includes(value),
    [SETTINGS_KEYS.LANGUAGE]: (value) => ['polish', 'english', 'ukrainian'].includes(value),
    [SETTINGS_KEYS.STORE_ID]: (value) => typeof value === 'string',
    [SETTINGS_KEYS.DEBUG_MODE]: (value) => typeof value === 'boolean',
    
    [SETTINGS_KEYS.SOUND]: (value) => {
        return typeof value === 'object' &&
            typeof value.enabled === 'boolean' &&
            typeof value.url === 'string' &&
            typeof value.volume === 'number' &&
            value.volume >= 0 &&
            value.volume <= 100;
    },
    
    [SETTINGS_KEYS.UI_CONFIG]: (value) => {
        return typeof value === 'object' &&
            typeof value.compactMode === 'boolean' &&
            typeof value.showCounts === 'boolean' &&
            typeof value.enableAnimations === 'boolean' &&
            typeof value.lastOpenTab === 'string';
    },
    
    [SETTINGS_KEYS.CACHE_CONFIG]: (value) => {
        return typeof value === 'object' &&
            typeof value.enabled === 'boolean' &&
            typeof value.ttl === 'number' &&
            typeof value.maxSize === 'number';
    },
    
    [SETTINGS_KEYS.REFRESH]: (value) => {
        const validIntervals = ['off', '30s', '1m', '2m', '3m', '5m', '15m', '30m', '60m', '1h', '3h', '6h', '12h', '24h'];
        return typeof value === 'object' &&
            validIntervals.includes(value.check_frequency) &&
            validIntervals.includes(value.notification_interval) &&
            validIntervals.includes(value.full_refresh) &&
            validIntervals.includes(value.data_freshness);
    },
    
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
    
    [SETTINGS_KEYS.USER]: (value) => {
        return typeof value === 'object' &&
            (value.id === null || typeof value.id === 'string') &&
            typeof value.preferences === 'object' &&
            typeof value.preferences.showTutorial === 'boolean' &&
            typeof value.preferences.showDebugPanel === 'boolean';
    }
};

/**
 * Manages application settings with validation and persistence
 * @extends {BaseManager}
 */
export class SettingsManager extends BaseManager {
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
    #saveTimeout = null;

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

        this.addDependency('storage');
        this.addDependency('event');
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
            
            // Get required dependencies
            const [storage, eventManager] = await Promise.all([
                this.getDependency('storage'),
                this.getDependency('event')
            ]);

            if (!storage?.isInitialized()) {
                throw new Error('Storage manager must be initialized');
            }

            // Store storage dependency
            this.#storage = storage;

            // Load settings from storage
            await this.#loadSettings();

            // Set up event listeners
            await eventManager.on('settings:changed', async (event) => {
                await this.updateSettings(event.settings);
            });

            // Apply initial settings
            await this.#applySettings();

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
            this.on(SETTINGS_KEYS.REFRESH, (value) => {
                this.log(LogLevel.INFO, '⚙️ Setting change triggered', {
                    setting: 'refresh',
                    value: value
                });
                refreshManager.updateSetting('check_frequency', value);
            });

            // Integracja z AlarmManager
            this.on(SETTINGS_KEYS.NOTIFICATIONS, (value) => {
                this.log(LogLevel.INFO, '⚙️ Setting change triggered', {
                    setting: 'notifications',
                    value: value
                });
                notificationManager.updateConfig({
                    enabled: value.enabled,
                    sound: value.sound,
                    desktop: value.desktop,
                    limits: value.limits
                });
            });

            // Integracja z LanguageManager
            this.on(SETTINGS_KEYS.LANGUAGE, (value) => {
                this.log(LogLevel.INFO, '⚙️ Setting change triggered', {
                    setting: 'language',
                    value: value
                });
                languageManager.setLanguage(value);
            });

            // Integracja z UI (theme)
            this.on(SETTINGS_KEYS.THEME, (value) => {
                this.log(LogLevel.INFO, '⚙️ Setting change triggered', {
                    setting: 'theme',
                    value: value
                });
                document.documentElement.setAttribute('data-theme', value);
                EventManager.emit('theme:changed', { theme: value });
            });

            // Integracja z Debug Mode
            this.on(SETTINGS_KEYS.DEBUG_MODE, (value) => {
                this.log(LogLevel.INFO, '⚙️ Setting change triggered', {
                    setting: 'debug_mode',
                    value: value
                });
                if (value) {
                    this.log(LogLevel.DEBUG, '🐛 Debug mode enabled');
                }
                EventManager.emit('debug:changed', { enabled: value });
            });

            // Integracja z Store ID
            this.on(SETTINGS_KEYS.STORE_ID, (value) => {
                this.log(LogLevel.INFO, '⚙️ Setting change triggered', {
                    setting: 'store_id',
                    value: value
                });
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
            if (!this.#storage) {
                throw new Error('Storage dependency not initialized');
            }

            // Load settings from storage
            const data = await this.#storage.get(STORAGE_KEY);
            
            if (data) {
                const { settings, version } = data;
                
                // Check if migration needed
                if (version !== this.#version) {
                    this.log(LogLevel.INFO, `🔄 Settings migration needed (${version} -> ${this.#version})`);
                    this.#migrationNeeded = true;
                }

                // Load and validate each setting
                if (settings) {
                    for (const [key, value] of Object.entries(settings)) {
                        if (this.#validateSetting(key, value)) {
                            this.#settings.set(key, value);
                            this.log(LogLevel.DEBUG, `✅ Loaded setting: ${key}`);
                        } else {
                            this.log(LogLevel.WARNING, `⚠️ Invalid setting value for ${key}, using default`);
                            this.#settings.set(key, DEFAULT_SETTINGS[key]);
                        }
                    }
                }
            }

            // Ensure all required settings exist
            await this.#ensureSettingsIntegrity();

        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM, {
                method: '#loadSettings'
            });
            // Use default values on error
            this.#settings = new Map(Object.entries(DEFAULT_SETTINGS));
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

    async updateSettings(newSettings) {
        this.#settings = new Map(this.#settings);
        for (const [key, value] of Object.entries(newSettings)) {
            if (this.#settings.has(key)) {
                this.#settings.set(key, value);
            } else {
                await this.set(key, value);
            }
        }

        // Clear existing save timeout
        if (this.#saveTimeout) {
            clearTimeout(this.#saveTimeout);
        }

        // Schedule save
        this.#saveTimeout = setTimeout(() => {
            this.#saveSettings();
        }, 1000);

        // Apply new settings
        await this.#applySettings();

        const eventManager = await this.getDependency('event');
        await eventManager.emit('settings:updated', {
            settings: Object.fromEntries(this.#settings),
            timestamp: new Date().toISOString()
        });
    }

    async #applySettings() {
        const eventManager = await this.getDependency('event');

        // Apply each setting type
        if (this.#settings.get(SETTINGS_KEYS.THEME)) {
            await eventManager.emit('theme:change', { theme: this.#settings.get(SETTINGS_KEYS.THEME) });
        }
        if (this.#settings.get(SETTINGS_KEYS.LANGUAGE)) {
            await eventManager.emit('language:change', { language: this.#settings.get(SETTINGS_KEYS.LANGUAGE) });
        }
        if (this.#settings.get(SETTINGS_KEYS.NOTIFICATIONS)) {
            await eventManager.emit('notifications:change', { notifications: this.#settings.get(SETTINGS_KEYS.NOTIFICATIONS) });
        }
        if (this.#settings.get(SETTINGS_KEYS.REFRESH)) {
            await eventManager.emit('refresh:change', { refresh: this.#settings.get(SETTINGS_KEYS.REFRESH) });
        }
        if (this.#settings.get(SETTINGS_KEYS.DEBUG_MODE)) {
            await eventManager.emit('debug:change', { debug_mode: this.#settings.get(SETTINGS_KEYS.DEBUG_MODE) });
        }
        if (this.#settings.get(SETTINGS_KEYS.STORE_ID)) {
            await eventManager.emit('store:change', { storeId: this.#settings.get(SETTINGS_KEYS.STORE_ID) });
        }
        if (this.#settings.get(SETTINGS_KEYS.SOUND)) {
            await eventManager.emit('sound:change', { settings: this.#settings.get(SETTINGS_KEYS.SOUND) });
        }
        if (this.#settings.get(SETTINGS_KEYS.UI_CONFIG)) {
            await eventManager.emit('ui:change', { config: this.#settings.get(SETTINGS_KEYS.UI_CONFIG) });
        }
        if (this.#settings.get(SETTINGS_KEYS.CACHE_CONFIG)) {
            await eventManager.emit('cache:change', { config: this.#settings.get(SETTINGS_KEYS.CACHE_CONFIG) });
        }

        // Update UI elements
        this.#updateUIElements();
    }

    #updateUIElements() {
        // Update radio buttons
        ['check_frequency', 'notification_interval', 'full_refresh', 'data_freshness'].forEach(setting => {
            const value = this.#settings.get(setting);
            const radio = document.querySelector(`input[name="${setting}"][value="${value}"]`);
            if (radio) {
                radio.checked = true;
            }
        });

        // Update sound URL
        const soundUrlInput = document.getElementById('sound-url');
        if (soundUrlInput) {
            soundUrlInput.value = this.#settings.get('sound_url') || '';
        }

        // Update volume slider
        const volumeSlider = document.getElementById('volume-slider');
        if (volumeSlider) {
            volumeSlider.value = this.#settings.get('volume') || 100;
        }
    }
}

// Export both class and instance
export const settingsManager = SettingsManager.getInstance(); 