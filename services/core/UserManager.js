import { BaseManager } from './BaseManager.js';
import { LogLevel } from './LogLevel.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { USER_CONFIG } from '../../config/user.js';

/**
 * @extends {BaseManager}
 * Manages user data and authentication state
 */
class UserManager extends BaseManager {
    static #instance = null;
    static _registry = null;
    #userData = null;
    #isAuthenticated = false;
    #settings;

    constructor(registry) {
        if (UserManager.#instance) {
            return UserManager.#instance;
        }
        super(registry, 'UserManager');
        UserManager.#instance = this;
        UserManager._registry = registry;
        
        // Add dependencies as strings
        this.addDependency('event');
        this.addDependency('storage');
    }

    static getInstance() {
        if (!UserManager.#instance && UserManager._registry) {
            UserManager.#instance = new UserManager(UserManager._registry);
        }
        return UserManager.#instance;
    }

    /**
     * Set registry for all instances
     * @param {ManagerRegistry} registry Manager registry
     */
    static setRegistry(registry) {
        UserManager._registry = registry;
    }

    /**
     * Initialize user manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing user manager...');
            
            // Load user settings
            const storage = await this.getDependency('storage');
            const settings = await storage.get(USER_CONFIG.STORAGE_KEY) || {};
            this.#settings = { ...USER_CONFIG.DEFAULT_SETTINGS, ...settings };
            
            // Set up event listeners
            await this.#setupEventListeners();
            
            this.log(LogLevel.SUCCESS, '✅ User manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
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
            this.#userData = data.userData || null;
            this.#isAuthenticated = !!data.isAuthenticated;
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
            if (userNameElement && this.#userData) {
                userNameElement.textContent = this.#userData.name || '-';
            }

            document.body.classList.toggle('authenticated', this.#isAuthenticated);
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
            this.#userData = userData;
            this.#isAuthenticated = !!userData;
            await chrome.storage.local.set({
                userData: this.#userData,
                isAuthenticated: this.#isAuthenticated
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
        return this.#userData;
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} Authentication status
     */
    isAuthenticated() {
        return this.#isAuthenticated;
    }

    /**
     * Clear user data and authentication state
     */
    async logout() {
        try {
            this.#userData = null;
            this.#isAuthenticated = false;
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

    /**
     * Set up event listeners
     * @private
     */
    async #setupEventListeners() {
        try {
            const eventManager = await this.getDependency('event');
            
            // Listen for user events
            await eventManager.on('user:login', this.setUserData.bind(this));
            await eventManager.on('user:logout', this.logout.bind(this));
            await eventManager.on('user:update', this.setUserData.bind(this));
            
            // Load initial user data
            await this._loadUserData();
            
            this.log(LogLevel.DEBUG, '🔄 User event listeners set up');
        } catch (error) {
            this.handleError(error, ErrorType.EVENT_LISTENER, ErrorSeverity.HIGH, {
                method: '#setupEventListeners'
            });
            throw error;
        }
    }
}

// Export both class and instance
export { UserManager };
export const userManager = UserManager.getInstance(); 
