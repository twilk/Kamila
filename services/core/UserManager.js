import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';

/**
 * @extends {BaseManager}
 * Manages user data and authentication state
 */
export class UserManager extends BaseManager {
    static _instance = null;

    static getInstance() {
        if (!UserManager._instance) {
            UserManager._instance = new UserManager();
        }
        return UserManager._instance;
    }

    constructor() {
        super('UserManager');
        if (UserManager._instance) {
            throw new Error('Use UserManager.getInstance()');
        }
        this._userData = null;
        this._isAuthenticated = false;
    }

    /**
     * Initialize user manager
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            await super.initialize();
            await this._loadUserData();
            this._updateUI();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
    }

    /**
     * Load user data from storage
     * @private
     */
    async _loadUserData() {
        try {
            const data = await chrome.storage.local.get(['userData', 'isAuthenticated']);
            this._userData = data.userData || null;
            this._isAuthenticated = !!data.isAuthenticated;
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM, {
                method: '_loadUserData'
            });
        }
    }

    /**
     * Update UI with user data
     * @private
     */
    _updateUI() {
        try {
            const userNameElement = document.querySelector('.user-name');
            if (userNameElement && this._userData) {
                userNameElement.textContent = this._userData.name || '-';
            }

            document.body.classList.toggle('authenticated', this._isAuthenticated);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: '_updateUI'
            });
        }
    }

    /**
     * Set user data
     * @param {Object} userData User data object
     */
    async setUserData(userData) {
        try {
            this._userData = userData;
            this._isAuthenticated = !!userData;
            await chrome.storage.local.set({
                userData: this._userData,
                isAuthenticated: this._isAuthenticated
            });
            this._updateUI();
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM, {
                method: 'setUserData'
            });
        }
    }

    /**
     * Get user data
     * @returns {Object|null} User data
     */
    getUserData() {
        return this._userData;
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} Authentication status
     */
    isAuthenticated() {
        return this._isAuthenticated;
    }

    /**
     * Clear user data and authentication state
     */
    async logout() {
        try {
            this._userData = null;
            this._isAuthenticated = false;
            await chrome.storage.local.remove(['userData', 'isAuthenticated']);
            this._updateUI();
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM, {
                method: 'logout'
            });
        }
    }

    /**
     * Cleanup and dispose
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
        }
    }
}

// Export singleton instance
export const userManager = UserManager.getInstance(); 