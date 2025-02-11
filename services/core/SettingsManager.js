import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { storageManager } from './StorageManager.js';

export class SettingsManager extends BaseManager {
    static _instance = null;

    static getInstance() {
        if (!SettingsManager._instance) {
            SettingsManager._instance = new SettingsManager();
        }
        return SettingsManager._instance;
    }

    constructor() {
        if (SettingsManager._instance) {
            throw new Error('SettingsManager is a singleton. Use SettingsManager.getInstance() instead.');
        }
        super('SettingsManager');
        this.settings = new Map();
        this.settingsListeners = new Map();
        this.validators = new Map();
        this.defaultValues = new Map();
        SettingsManager._instance = this;
    }

    // ... existing code ...
}

// Export singleton instance
export const settingsManager = SettingsManager.getInstance(); 