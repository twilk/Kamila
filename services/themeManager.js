import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';

export class ThemeManager extends BaseManager {
    constructor() {
        super();
        this.currentTheme = 'light';
        this.themeListeners = new Set();
        this.systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    }

    async initialize() {
        try {
            await super.initialize();
            await this.loadThemePreference();
            this.initializeThemeControls();
            this.initializeSystemThemeListener();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    async loadThemePreference() {
        try {
            const { theme, useSystemTheme } = await chrome.storage.local.get(['theme', 'useSystemTheme']);
            
            if (useSystemTheme) {
                this.setTheme(this.systemThemeMediaQuery.matches ? 'dark' : 'light');
            } else if (theme) {
                this.setTheme(theme);
            }
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.WARNING, {
                method: 'loadThemePreference'
            });
        }
    }

    initializeThemeControls() {
        try {
            const themeToggle = document.getElementById('theme-toggle');
            const systemThemeCheckbox = document.getElementById('use-system-theme');
            
            if (themeToggle) {
                themeToggle.addEventListener('click', () => {
                    this.toggleTheme();
                });
            }

            if (systemThemeCheckbox) {
                systemThemeCheckbox.addEventListener('change', (e) => {
                    this.setUseSystemTheme(e.target.checked);
                });
            }

            // Update UI to match current state
            this.updateThemeControls();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeThemeControls'
            });
        }
    }

    initializeSystemThemeListener() {
        try {
            this.systemThemeMediaQuery.addEventListener('change', (e) => {
                if (this.useSystemTheme) {
                    this.setTheme(e.matches ? 'dark' : 'light');
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeSystemThemeListener'
            });
        }
    }

    async setTheme(theme) {
        try {
            if (theme !== 'light' && theme !== 'dark') {
                throw new Error('Invalid theme');
            }

            this.currentTheme = theme;
            document.documentElement.setAttribute('data-theme', theme);
            
            // Update storage if not using system theme
            if (!this.useSystemTheme) {
                await chrome.storage.local.set({ theme });
            }

            // Update UI
            this.updateThemeControls();

            // Notify listeners
            this.notifyThemeChange();

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'setTheme',
                theme
            });
            return false;
        }
    }

    async toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        return this.setTheme(newTheme);
    }

    async setUseSystemTheme(useSystem) {
        try {
            this.useSystemTheme = useSystem;
            await chrome.storage.local.set({ useSystemTheme: useSystem });

            if (useSystem) {
                this.setTheme(this.systemThemeMediaQuery.matches ? 'dark' : 'light');
            }

            // Update UI
            this.updateThemeControls();

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'setUseSystemTheme',
                useSystem
            });
            return false;
        }
    }

    updateThemeControls() {
        try {
            const themeToggle = document.getElementById('theme-toggle');
            const systemThemeCheckbox = document.getElementById('use-system-theme');
            
            if (themeToggle) {
                themeToggle.setAttribute('aria-label', 
                    this.currentTheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
                );
                themeToggle.classList.toggle('theme-dark', this.currentTheme === 'dark');
            }

            if (systemThemeCheckbox) {
                systemThemeCheckbox.checked = this.useSystemTheme;
                systemThemeCheckbox.disabled = false;
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateThemeControls'
            });
        }
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    isUsingSystemTheme() {
        return this.useSystemTheme;
    }

    addThemeListener(callback) {
        this.themeListeners.add(callback);
        return () => this.themeListeners.delete(callback);
    }

    notifyThemeChange() {
        const theme = this.getCurrentTheme();
        this.themeListeners.forEach(listener => {
            try {
                listener(theme);
            } catch (error) {
                this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.WARNING, {
                    method: 'notifyThemeChange',
                    listener: 'themeChange'
                });
            }
        });
    }

    dispose() {
        try {
            this.systemThemeMediaQuery.removeEventListener('change', this.handleSystemThemeChange);
            this.themeListeners.clear();
            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 