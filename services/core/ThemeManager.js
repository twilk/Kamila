import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { THEME_CONFIG } from '../../config/theme.js';

/**
 * @extends {BaseManager}
 * Manages theme settings and switching between light/dark modes
 */
class ThemeManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;

    /** @private */
    #currentTheme = 'light';
    #useSystemTheme = true;
    #eventManager = null;
    #settings;

    // Private method declarations
    // #setupEventListeners = undefined;
    // #setupSystemThemeDetection = undefined;
    // #removeSystemThemeDetection = undefined;
    // #updateDOMTheme = undefined;

    constructor(registry) {
        if (ThemeManager.#instance) {
            return ThemeManager.#instance;
        }
        super(registry, 'ThemeManager');
        ThemeManager.#instance = this;
        ThemeManager._registry = registry;
        
        // Add dependencies
        this.addDependency('event');
    }

    static getInstance() {
        if (!ThemeManager.#instance && ThemeManager._registry) {
            ThemeManager.#instance = new ThemeManager(ThemeManager._registry);
        }
        return ThemeManager.#instance;
    }

    static setRegistry(registry) {
        ThemeManager._registry = registry;
    }

    /**
     * Initialize theme manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing theme manager...');
            
            // Load theme settings
            const storage = await this.getDependency('storage');
            const settings = await storage.get(THEME_CONFIG.STORAGE_KEY) || {};
            this.#settings = { ...THEME_CONFIG.DEFAULT_SETTINGS, ...settings };
            
            // Set up event listeners
            await this.#setupEventListeners();
            
            this.log(LogLevel.SUCCESS, '✅ Theme manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Set up event listeners
     * @private
     */
    #setupEventListeners = async () => {
        try {
            // Get event manager dependency
            this.#eventManager = await this.getDependency('event');
            
            // Listen for theme toggle events
            await this.#eventManager.on('theme:toggle', this.toggleTheme.bind(this));
            
            // Listen for system theme preference changes
            if (this.#useSystemTheme) {
                this.#setupSystemThemeDetection();
            }
            
            // Setup DOM event listeners for theme actions
            document.addEventListener('click', async (event) => {
                const themeAction = event.target.closest('[data-theme-action]');
                if (!themeAction) return;
                
                const action = themeAction.dataset.themeAction;
                switch (action) {
                    case 'toggle':
                        await this.toggleTheme();
                        break;
                    case 'system':
                        await this.setTheme(this.#currentTheme, true);
                        break;
                    case 'light':
                        await this.setTheme('light', false);
                        break;
                    case 'dark':
                        await this.setTheme('dark', false);
                        break;
                }
            });
            
            this.log(LogLevel.DEBUG, '🎨 Theme event listeners set up');
        } catch (error) {
            this.handleError(error, ErrorType.EVENT_LISTENER, ErrorSeverity.HIGH, {
                method: 'setupEventListeners'
            });
            throw error;
        }
    };

    /**
     * Set theme and save preferences
     * @param {string} theme - Theme to set ('light' or 'dark')
     * @param {boolean} useSystem - Whether to use system theme
     * @returns {Promise<void>}
     */
    async setTheme(theme, useSystem = false) {
        try {
            // Validate theme
            if (theme !== 'light' && theme !== 'dark') {
                throw new Error(`Invalid theme: ${theme}`);
            }

            // Update settings
            this.#currentTheme = theme;
            this.#useSystemTheme = useSystem;

            // Save preferences
            await chrome.storage.local.set({
                theme: this.#currentTheme,
                useSystemTheme: this.#useSystemTheme
            });

            // Apply theme
            await this.applyTheme();

            // Set up or remove system theme detection
            if (this.#useSystemTheme) {
                this.#setupSystemThemeDetection();
            } else {
                this.#removeSystemThemeDetection();
            }

            this.log(LogLevel.INFO, `Theme set to ${theme}`, {
                useSystem,
                theme
            });
        } catch (error) {
            this.handleError(error, ErrorType.OPERATION, ErrorSeverity.MEDIUM, {
                method: 'setTheme',
                theme,
                useSystem
            });
        }
    }

    /**
     * Set up system theme detection
     * @private
     */
    #setupSystemThemeDetection = () => {
        try {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            // Remove existing listener if any
            this.#removeSystemThemeDetection();
            
            // Add new listener
            const handleChange = (e) => {
                const newTheme = e.matches ? 'dark' : 'light';
                this.applyTheme(newTheme);
            };
            
            mediaQuery.addListener(handleChange);
            this._systemThemeListener = handleChange;
            
            // Apply initial system theme
            handleChange(mediaQuery);
            
            this.log(LogLevel.DEBUG, '🎨 System theme detection enabled');
        } catch (error) {
            this.handleError(error, ErrorType.OPERATION, ErrorSeverity.LOW, {
                method: 'setupSystemThemeDetection'
            });
        }
    };

    /**
     * Remove system theme detection
     * @private
     */
    #removeSystemThemeDetection = () => {
        try {
            if (this._systemThemeListener) {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                mediaQuery.removeListener(this._systemThemeListener);
                this._systemThemeListener = null;
                this.log(LogLevel.DEBUG, '🎨 System theme detection disabled');
            }
        } catch (error) {
            this.handleError(error, ErrorType.OPERATION, ErrorSeverity.LOW, {
                method: 'removeSystemThemeDetection'
            });
        }
    };

    /**
     * Apply current theme to the application
     * @param {string} [overrideTheme] Optional theme to apply instead of current
     */
    async applyTheme(overrideTheme = null) {
        try {
            const themeToApply = overrideTheme || this.#currentTheme;
            
            // Update DOM
            await this.#updateDOMTheme(themeToApply);

            // Dispatch theme change event
            const eventManager = await this.getDependency('event');
            await eventManager.emit('theme:applied', {
                theme: themeToApply,
                timestamp: new Date().toISOString()
            });

            this.log(LogLevel.DEBUG, `🎨 Applied theme: ${themeToApply}`);
        } catch (error) {
            this.handleError(error, ErrorType.OPERATION, ErrorSeverity.MEDIUM, {
                method: 'applyTheme',
                theme: overrideTheme || this.#currentTheme
            });
        }
    }

    /**
     * Update DOM theme classes and attributes
     * @private
     */
    #updateDOMTheme = async (theme) => {
        try {
            // Remove existing theme classes
            document.documentElement.classList.remove('theme-light', 'theme-dark');
            
            // Add new theme class
            document.documentElement.classList.add(`theme-${theme}`);
            
            // Update data attribute
            document.documentElement.setAttribute('data-theme', theme);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: 'updateDOMTheme',
                theme
            });
        }
    };

    /**
     * Get current theme settings
     * @returns {{ theme: string, useSystemTheme: boolean }}
     */
    getThemeSettings() {
        return {
            theme: this.#currentTheme,
            useSystemTheme: this.#useSystemTheme
        };
    }

    /**
     * Toggle between light and dark themes
     */
    async toggleTheme() {
        try {
            const newTheme = this.#currentTheme === 'light' ? 'dark' : 'light';
            await this.setTheme(newTheme, false);
        } catch (error) {
            this.handleError(error, ErrorType.OPERATION, ErrorSeverity.LOW, {
                method: 'toggleTheme'
            });
        }
    }

    /**
     * Cleanup and dispose
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            // Clean up event listeners if EventManager is available
            if (this.#eventManager) {
                this.#eventManager.undelegate('click', '[data-theme-action]');
            }
            
            // Remove system theme detection
            this.#removeSystemThemeDetection();
            
            this.#eventManager = null;
            await super.dispose();
            this.log(LogLevel.INFO, '🧹 Theme manager disposed');
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
        }
    }
}

// Export both class and instance
export { ThemeManager };
export const themeManager = ThemeManager.getInstance(); 
