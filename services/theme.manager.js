import { DEFAULT_COLORS } from '../config/theme.js';
import { THEME_CONFIG } from '../config/theme.js';
import { PerformanceMonitor } from './performance.js';
import { apiService } from './api.service.js';
import { REQUEST_LIMITS } from '../config/request.limits.js';

/**
 * Zarządza stanem i logiką motywów
 */
export class ThemeManager {
    constructor() {
        this.state = {
            currentTheme: localStorage.getItem('theme') || 'light',
            customColors: JSON.parse(localStorage.getItem('customColors')) || DEFAULT_COLORS,
            isPanelOpen: false,
            isSyncing: false
        };
        
        this.subscribers = new Set();
        this.performanceMonitor = new PerformanceMonitor();
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
        const oldTheme = this.state.currentTheme;
        this.state.currentTheme = theme;
        
        await this.performanceMonitor.batchDOMUpdates(() => {
            document.body.classList.remove(`${oldTheme}-theme`);
            document.body.classList.add(`${theme}-theme`);
            
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
        
        if (shouldSync) {
            this.syncWithServer();
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
        this.subscribers.forEach(callback => callback(this.state));
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
}

// Upewnijmy się, że klasa jest eksportowana jako default
export default ThemeManager; 