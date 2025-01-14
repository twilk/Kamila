import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';
import { i18n } from './i18n.js';

export class UpdateManager extends BaseManager {
    constructor(eventManager) {
        super([eventManager]);
        this.eventManager = eventManager;
        this.updateAvailable = false;
        this.lastCheck = null;
    }

    async initialize() {
        try {
            await super.initialize();
            await this.initializeUpdateButton();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    async initializeUpdateButton() {
        try {
            const updateButton = document.getElementById('check-update');
            if (!updateButton) return;

            // Disable update button
            updateButton.style.display = 'none';

            // Show current version
            const versionElement = document.getElementById('version');
            if (versionElement) {
                versionElement.textContent = i18n.translate('version').replace('{version}', this.currentVersion);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeUpdateButton'
            });
        }
    }

    dispose() {
        try {
            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
}
