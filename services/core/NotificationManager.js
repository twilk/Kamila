import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { i18n } from '../i18n.js';

export class NotificationManager extends BaseManager {
    static _instance = null;

    static getInstance() {
        if (!NotificationManager._instance) {
            NotificationManager._instance = new NotificationManager();
        }
        return NotificationManager._instance;
    }

    constructor() {
        if (NotificationManager._instance) {
            throw new Error('NotificationManager is a singleton. Use NotificationManager.getInstance() instead.');
        }
        super('NotificationManager');
        this.notifications = new Map();
        this.notificationIdCounter = 0;
        this.defaultDuration = 5000; // 5 seconds
        this.container = null;
        NotificationManager._instance = this;
    }

    // ... existing code ...
}

// Export singleton instance
export const notificationManager = NotificationManager.getInstance(); 