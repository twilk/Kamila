import { logService } from './LogService.js';
import { cacheService } from './CacheService.js';

const THEME_CACHE_KEY = 'selectedTheme';
const SUPPORTED_THEMES = ['light', 'dark', 'system'];

export class ThemeService {
    constructor() {
        this.currentTheme = 'system';
        this.initialized = false;
        this.observers = new Set();
        this.systemPreference = window.matchMedia('(prefers-color-scheme: dark)');
        this.boundSystemPreferenceHandler = this.handleSystemPreferenceChange.bind(this);
        logService.info('ThemeService constructed');
    }

    async initialize() {
        if (this.initialized) {
            logService.debug('ThemeService already initialized');
            return;
        }

        try {
            logService.info('Initializing ThemeService...');

            // Load saved theme preference
            const savedTheme = await cacheService.get(THEME_CACHE_KEY);
            if (savedTheme && SUPPORTED_THEMES.includes(savedTheme)) {
                this.currentTheme = savedTheme;
                logService.debug('Restored theme preference', { theme: savedTheme });
            }

            // Setup system preference listener
            this.systemPreference.addListener(this.boundSystemPreferenceHandler);
            
            // Apply initial theme
            await this.applyTheme(this.currentTheme);
            
            this.initialized = true;
            logService.info('ThemeService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize ThemeService', error);
            throw error;
        }
    }

    handleSystemPreferenceChange(event) {
        if (!this.initialized) return;

        try {
            if (this.currentTheme === 'system') {
                this.applyTheme('system');
                logService.debug('System theme preference changed', { isDark: event.matches });
            }
        } catch (error) {
            logService.error('Error handling system preference change', error);
        }
    }

    async setTheme(theme) {
        if (!this.initialized) {
            throw new Error('Cannot set theme before initialization');
        }

        if (!SUPPORTED_THEMES.includes(theme)) {
            throw new Error(`Unsupported theme: ${theme}`);
        }

        if (theme === this.currentTheme) {
            logService.debug('Theme already set', { theme });
            return;
        }

        try {
            logService.debug('Setting theme...', { theme });
            this.currentTheme = theme;
            await cacheService.set(THEME_CACHE_KEY, theme);
            await this.applyTheme(theme);
            logService.info('Theme updated successfully', { theme });
        } catch (error) {
            logService.error('Failed to set theme', error);
            throw error;
        }
    }

    async applyTheme(theme) {
        try {
            const effectiveTheme = this.getEffectiveTheme(theme);
            logService.debug('Applying theme...', { theme, effectiveTheme });
            
            // Apply theme to document
            document.documentElement.setAttribute('data-theme', effectiveTheme);
            
            // Apply theme-specific styles
            document.body.classList.remove('theme-light', 'theme-dark');
            document.body.classList.add(`theme-${effectiveTheme}`);
            
            // Notify observers
            this.notifyObservers(effectiveTheme);
            
            logService.debug('Theme applied successfully');
        } catch (error) {
            logService.error('Failed to apply theme', error);
            throw error;
        }
    }

    getEffectiveTheme(theme = this.currentTheme) {
        return theme === 'system'
            ? (this.systemPreference.matches ? 'dark' : 'light')
            : theme;
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    getSupportedThemes() {
        return [...SUPPORTED_THEMES];
    }

    addObserver(callback) {
        this.observers.add(callback);
    }

    removeObserver(callback) {
        this.observers.delete(callback);
    }

    notifyObservers(theme) {
        this.observers.forEach(callback => {
            try {
                callback(theme);
            } catch (error) {
                logService.error('Error in theme observer callback', error);
            }
        });
    }

    async toggleTheme() {
        if (!this.initialized) {
            throw new Error('Cannot toggle theme before initialization');
        }

        try {
            const currentEffective = this.getEffectiveTheme();
            const newTheme = currentEffective === 'light' ? 'dark' : 'light';
            await this.setTheme(newTheme);
            logService.debug('Theme toggled successfully', { from: currentEffective, to: newTheme });
        } catch (error) {
            logService.error('Failed to toggle theme', error);
            throw error;
        }
    }

    cleanup() {
        if (!this.initialized) return;

        try {
            logService.debug('Cleaning up ThemeService...');
            
            // Remove system preference listener
            this.systemPreference.removeListener(this.boundSystemPreferenceHandler);
            
            // Clear observers
            this.observers.clear();
            
            this.initialized = false;
            logService.debug('ThemeService cleaned up successfully');
        } catch (error) {
            logService.error('Error during cleanup', error);
            throw error;
        }
    }
}

export const themeService = new ThemeService(); 