import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';

export class SettingsManager extends BaseManager {
    constructor() {
        super();
        this.settings = new Map();
        this.settingsListeners = new Map();
        this.validators = new Map();
        this.defaultValues = new Map();
    }

    async initialize() {
        try {
            await super.initialize();
            await this.registerDefaultSettings();
            await this.loadSettings();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    registerDefaultSettings() {
        // Rejestracja domyślnych ustawień
        this.registerSetting('refreshInterval', {
            default: 60000,
            validator: value => typeof value === 'number' && value >= 5000,
            category: 'performance'
        });

        this.registerSetting('notificationsEnabled', {
            default: true,
            validator: value => typeof value === 'boolean',
            category: 'notifications'
        });

        this.registerSetting('notificationSound', {
            default: true,
            validator: value => typeof value === 'boolean',
            category: 'notifications'
        });

        this.registerSetting('language', {
            default: 'pl',
            validator: value => ['pl', 'en'].includes(value),
            category: 'interface'
        });

        this.registerSetting('fontSize', {
            default: 'medium',
            validator: value => ['small', 'medium', 'large'].includes(value),
            category: 'interface'
        });

        this.registerSetting('debugMode', {
            default: false,
            validator: value => typeof value === 'boolean',
            category: 'development'
        });

        this.registerSetting('cacheTimeout', {
            default: 300000,
            validator: value => typeof value === 'number' && value >= 0,
            category: 'performance'
        });
    }

    registerSetting(key, options) {
        try {
            const { default: defaultValue, validator, category } = options;

            if (this.settings.has(key)) {
                throw new Error(`Setting ${key} already registered`);
            }

            this.defaultValues.set(key, defaultValue);
            
            if (validator) {
                this.validators.set(key, validator);
            }

            // Initialize with default value
            this.settings.set(key, defaultValue);

            // Initialize listeners array for this setting
            this.settingsListeners.set(key, new Set());

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.VALIDATION, ErrorSeverity.WARNING, {
                method: 'registerSetting',
                key,
                options
            });
            return false;
        }
    }

    async loadSettings() {
        try {
            // Load all registered settings from storage
            const keys = Array.from(this.settings.keys());
            const storedSettings = await chrome.storage.local.get(keys);

            // Update settings with stored values or defaults
            for (const key of keys) {
                const storedValue = storedSettings[key];
                const defaultValue = this.defaultValues.get(key);

                if (storedValue !== undefined) {
                    await this.setSetting(key, storedValue);
                } else {
                    await this.setSetting(key, defaultValue);
                }
            }

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.WARNING, {
                method: 'loadSettings'
            });
            return false;
        }
    }

    async setSetting(key, value) {
        try {
            // Check if setting exists
            if (!this.settings.has(key)) {
                throw new Error(`Setting ${key} not registered`);
            }

            // Validate value if validator exists
            const validator = this.validators.get(key);
            if (validator && !validator(value)) {
                throw new Error(`Invalid value for setting ${key}`);
            }

            // Update value
            this.settings.set(key, value);

            // Save to storage
            await chrome.storage.local.set({ [key]: value });

            // Notify listeners
            this.notifySettingChange(key, value);

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.VALIDATION, ErrorSeverity.WARNING, {
                method: 'setSetting',
                key,
                value
            });
            return false;
        }
    }

    getSetting(key) {
        try {
            if (!this.settings.has(key)) {
                throw new Error(`Setting ${key} not registered`);
            }
            return this.settings.get(key);
        } catch (error) {
            this.handleError(error, ErrorType.VALIDATION, ErrorSeverity.WARNING, {
                method: 'getSetting',
                key
            });
            return this.defaultValues.get(key);
        }
    }

    getDefaultValue(key) {
        return this.defaultValues.get(key);
    }

    resetSetting(key) {
        return this.setSetting(key, this.getDefaultValue(key));
    }

    async resetAllSettings() {
        try {
            const keys = Array.from(this.settings.keys());
            for (const key of keys) {
                await this.resetSetting(key);
            }
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.WARNING, {
                method: 'resetAllSettings'
            });
            return false;
        }
    }

    addSettingListener(key, callback) {
        try {
            if (!this.settingsListeners.has(key)) {
                throw new Error(`Setting ${key} not registered`);
            }

            const listeners = this.settingsListeners.get(key);
            listeners.add(callback);

            // Return cleanup function
            return () => listeners.delete(callback);
        } catch (error) {
            this.handleError(error, ErrorType.VALIDATION, ErrorSeverity.WARNING, {
                method: 'addSettingListener',
                key
            });
            return () => {};
        }
    }

    notifySettingChange(key, value) {
        try {
            const listeners = this.settingsListeners.get(key);
            if (!listeners) return;

            listeners.forEach(listener => {
                try {
                    listener(value);
                } catch (error) {
                    this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.WARNING, {
                        method: 'notifySettingChange',
                        key,
                        value
                    });
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.WARNING, {
                method: 'notifySettingChange',
                key,
                value
            });
        }
    }

    getSettingsByCategory(category) {
        try {
            const result = new Map();
            for (const [key, value] of this.settings) {
                if (this.getSettingCategory(key) === category) {
                    result.set(key, value);
                }
            }
            return result;
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.WARNING, {
                method: 'getSettingsByCategory',
                category
            });
            return new Map();
        }
    }

    getSettingCategory(key) {
        try {
            // Implementacja kategorii ustawień
            const categoryMap = {
                refreshInterval: 'performance',
                notificationsEnabled: 'notifications',
                notificationSound: 'notifications',
                language: 'interface',
                fontSize: 'interface',
                debugMode: 'development',
                cacheTimeout: 'performance'
            };
            return categoryMap[key] || 'general';
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.WARNING, {
                method: 'getSettingCategory',
                key
            });
            return 'general';
        }
    }

    dispose() {
        try {
            this.settings.clear();
            this.settingsListeners.clear();
            this.validators.clear();
            this.defaultValues.clear();
            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 