import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { EventManager } from './EventManager.js';

/**
 * @extends {BaseManager}
 * Manages theme settings and switching between light/dark modes
 */
export class ThemeManager extends BaseManager {
    static #instance = null;
    #currentTheme = 'light';
    #useSystemTheme = true;
    #eventManager = null;

    static getInstance() {
        if (!ThemeManager.#instance) {
            ThemeManager.#instance = new ThemeManager();
        }
        return ThemeManager.#instance;
    }

    constructor() {
        super('ThemeManager');
        if (ThemeManager.#instance) {
            throw new Error('Use ThemeManager.getInstance()');
        }
        
        // Add EventManager dependency
        this.addDependency(EventManager.getInstance());
    }

    /**
     * Initialize theme manager
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            await super.initialize();
            
            // Get EventManager instance
            this.#eventManager = EventManager.getInstance();

            // Load saved theme preferences
            const { useSystemTheme, theme } = await chrome.storage.local.get({
                useSystemTheme: true,
                theme: 'light'
            });

            this.#useSystemTheme = useSystemTheme;
            this.#currentTheme = theme;

            // Set up system theme detection
            if (this.#useSystemTheme) {
                this.#setupSystemThemeDetection();
            }

            // Apply initial theme
            await this.applyTheme();

            // Listen for theme change events
            if (this.#eventManager) {
                this.#eventManager.delegate('click', '[data-theme-action]', async (event) => {
                    const target = event.target;
                    const theme = target.dataset.theme;
                    const useSystem = target.dataset.useSystem === 'true';
                    await this.setTheme(theme, useSystem);
                });
            }

            this.log(LogLevel.SUCCESS, '✅ ThemeManager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
    }

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
    #setupSystemThemeDetection() {
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
    }

    /**
     * Remove system theme detection
     * @private
     */
    #removeSystemThemeDetection() {
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
    }

    /**
     * Apply current theme to the application
     * @param {string} [overrideTheme] Optional theme to apply instead of current
     */
    async applyTheme(overrideTheme = null) {
        try {
            const themeToApply = overrideTheme || this.#currentTheme;
            
            // Remove existing theme classes
            document.documentElement.classList.remove('theme-light', 'theme-dark');
            
            // Add new theme class
            document.documentElement.classList.add(`theme-${themeToApply}`);
            
            // Update data attribute
            document.documentElement.setAttribute('data-theme', themeToApply);

            // Dispatch theme change event
            const themeEvent = new CustomEvent('theme:applied', {
                detail: {
                    theme: themeToApply,
                    useSystem: this.#useSystemTheme
                }
            });
            window.dispatchEvent(themeEvent);

            this.log(LogLevel.DEBUG, `🎨 Applied theme: ${themeToApply}`);
        } catch (error) {
            this.handleError(error, ErrorType.OPERATION, ErrorSeverity.MEDIUM, {
                method: 'applyTheme',
                theme: overrideTheme || this.#currentTheme
            });
        }
    }

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

// Export singleton instance
export const themeManager = ThemeManager.getInstance(); 