import { DEFAULT_COLORS, THEME_CONFIG } from '../config/theme.js';
import { performanceMonitor } from './performance.js';
import { apiService } from './api.service.js';
import { REQUEST_LIMITS } from '../config/request.limits.js';
import { i18n } from '../services/i18n.js';
import { accessibilityService } from './accessibility.js';

/**
 * Zarządza stanem i logiką motywów
 */
export class ThemeManager {
    static instance = null;

    constructor() {
        if (ThemeManager.instance) {
            return ThemeManager.instance;
        }
        ThemeManager.instance = this;

        this.state = {
            currentTheme: this.getInitialTheme(),
            customColors: this.getInitialColors(),
            isPanelOpen: false,
            isSyncing: false
        };
        
        this.subscribers = new Set();
        this.performanceMonitor = performanceMonitor;
        this.api = apiService;
        
        this.init();
    }
    
    init() {
        // Zastosuj zapisany motyw przy starcie
        document.body.classList.add(`${this.state.currentTheme}-theme`);
        
        if (this.state.currentTheme === 'custom') {
            this.applyCustomColors();
        } else {
            this.applyThemeColors(this.state.currentTheme);
        }
    }
    
    applyThemeColors(themeName) {
        const theme = THEME_CONFIG[themeName];
        if (!theme) return;

        const root = document.documentElement;
        
        // Podstawowe kolory
        root.style.setProperty('--background', theme.background);
        root.style.setProperty('--text', theme.text);
        root.style.setProperty('--border', theme.border);
        root.style.setProperty('--shadow', theme.shadow);
        
        // Panel
        root.style.setProperty('--panel-bg', theme.panel.bg);
        root.style.setProperty('--panel-text', theme.panel.text);
        root.style.setProperty('--panel-border', theme.panel.border);
        root.style.setProperty('--panel-shadow', theme.panel.shadow);
        
        // Przyciski
        root.style.setProperty('--btn-bg', theme.button.bg);
        root.style.setProperty('--btn-text', theme.button.text);
        root.style.setProperty('--btn-border', theme.button.border);
        root.style.setProperty('--btn-hover', theme.button.hover);
        root.style.setProperty('--btn-active', theme.button.active);
    }
    
    async toggleTheme(theme, shouldSync = true) {
        try {
            const oldTheme = this.state.currentTheme;
            this.state.currentTheme = theme;
            
            await this.performanceMonitor.batchDOMUpdates(() => {
                document.documentElement.classList.remove(`${oldTheme}-theme`);
                document.documentElement.classList.add(`${theme}-theme`);
                
                if (theme === 'custom') {
                    this.applyCustomColors();
                } else {
                    this.applyThemeColors(theme);
                }
            });
            
            await this.performanceMonitor.optimizeStorageOperation(() => {
                localStorage.setItem('theme', theme);
            });
            
            this.notifySubscribers();
            logToPanel(`🎨 Zastosowano motyw: ${theme}`, 'success');
            
            if (shouldSync) {
                this.syncWithServer();
            }
        } catch (error) {
            console.error('Error toggling theme:', error);
            logToPanel('❌ Błąd podczas zmiany motywu', 'error', error);
            throw error;
        }
    }
    
    async updateCustomColors(colors) {
        this.performanceMonitor.startMeasure('colors-update');
        
        this.state.customColors = colors;
        
        await this.performanceMonitor.optimizeStorageOperation(() => {
            localStorage.setItem('customColors', JSON.stringify(colors));
        });
        
        if (this.state.currentTheme === 'custom') {
            this.applyCustomColors(colors);
        }
        
        this.notifySubscribers();
        
        const updateTime = this.performanceMonitor.endMeasure('colors-update');
        console.debug(`Colors update completed in ${updateTime}ms`);
    }

    applyCustomColors() {
        const colors = this.state.customColors;
        document.documentElement.style.setProperty('--primary', colors.primary || '#495057');
        document.documentElement.style.setProperty('--secondary', colors.secondary || '#6c757d');
    }

    resetColors() {
        const defaultColors = {
            primary: '#495057',
            secondary: '#6c757d'
        };
        this.updateCustomColors(defaultColors);
        return defaultColors;
    }

    getCurrentTheme() {
        return this.state.currentTheme;
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        callback(this.state);
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notifySubscribers();
    }

    /**
     * Powiadamia subskrybentów o zmianach stanu
     */
    notifySubscribers() {
        try {
            this.subscribers.forEach(callback => {
                try {
                    callback(this.state);
                } catch (error) {
                    console.warn('Error in theme subscriber callback:', error);
                }
            });
        } catch (error) {
            console.error('Failed to notify theme subscribers:', error);
        }
    }

    /**
     * Synchronizuje ustawienia motywu z serwerem
     */
    async syncWithServer() {
        if (this.state.isSyncing) return;
        
        this.state.isSyncing = true;
        this.notifySubscribers();
        
        try {
            await this.api.backgroundRequest({
                endpoint: '/theme/sync',
                method: 'POST',
                data: {
                    theme: this.state.currentTheme,
                    colors: this.state.customColors
                }
            });
        } catch (error) {
            console.warn('Theme sync failed:', error);
        } finally {
            this.state.isSyncing = false;
            this.notifySubscribers();
        }
    }

    /**
     * Pobiera ustawienia motywu z serwera
     */
    async fetchThemeSettings() {
        try {
            const settings = await this.api.request({
                endpoint: '/theme/settings',
                priority: REQUEST_LIMITS.priority.HIGH
            });
            
            if (settings) {
                this.updateThemeFromServer(settings);
            }
        } catch (error) {
            console.warn('Failed to fetch theme settings:', error);
        }
    }

    /**
     * Aktualizuje motyw na podstawie danych z serwera
     */
    updateThemeFromServer(settings) {
        const { theme, colors } = settings;
        
        if (theme && theme !== this.state.currentTheme) {
            this.toggleTheme(theme, false); // false = nie synchronizuj z powrotem
        }
        
        if (colors) {
            this.updateCustomColors(colors, false);
        }
    }

    /**
     * Pobiera początkowy motyw
     */
    getInitialTheme() {
        try {
            return localStorage.getItem('theme') || 'light';
        } catch (error) {
            console.warn('Failed to get theme from localStorage:', error);
            return 'light';
        }
    }

    /**
     * Pobiera początkowe kolory
     */
    getInitialColors() {
        try {
            const savedColors = localStorage.getItem('customColors');
            return savedColors ? JSON.parse(savedColors) : {
                primary: '#495057',
                secondary: '#6c757d'
            };
        } catch (error) {
            console.warn('Failed to get colors from localStorage:', error);
            return {
                primary: '#495057',
                secondary: '#6c757d'
            };
        }
    }
}

// Export singleton instance
export const themeManager = new ThemeManager(); 