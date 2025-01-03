import { logService } from './LogService.js';

/**
 * Service for handling internationalization
 */
export class I18nService {
    constructor() {
        this.translations = new Map();
        this.currentLocale = 'polish';
        logService.info('I18nService constructed');
    }

    // ... existing code ...
}

// Create and export singleton instance
export const i18nService = new I18nService(); 