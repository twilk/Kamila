import { logService } from './LogService.js';
import { themeService } from './ThemeService.js';
import { i18nService } from './I18nService.js';

/**
 * Service for managing UI components
 */
export class UIComponentService {
    constructor() {
        this.initialized = false;
        this.components = new Map();
        logService.info('UIComponentService constructed');
    }

    async initialize() {
        if (this.initialized) {
            logService.debug('UIComponentService already initialized');
            return;
        }

        try {
            logService.info('Initializing UI components...');
            
            // Wait for DOM to be fully loaded
            if (document.readyState !== 'complete') {
                await new Promise(resolve => {
                    window.addEventListener('load', resolve);
                });
            }
            
            // Initialize core components
            await this.initializeComponents();
            
            // Setup event listeners
            await this.setupEventListeners();
            
            this.initialized = true;
            logService.info('UIComponentService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize UI components:', error);
            throw error;
        }
    }

    async initializeComponents() {
        try {
            // Initialize debug panel
            await this.initializeDebugPanel();
            
            // Initialize tooltips
            this.initializeTooltips();
            
            // Initialize modals
            this.initializeModals();
            
            logService.debug('Components initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize components:', error);
            throw error;
        }
    }

    initializeDebugPanel() {
        try {
            const debugPanel = document.getElementById('debug-panel');
            if (!debugPanel) {
                logService.debug('Debug panel element not found');
                return;
            }

            // Setup debug panel toggle
            const debugToggle = document.querySelector('[data-control="debug-toggle"]');
            if (debugToggle) {
                debugToggle.addEventListener('click', () => {
                    debugPanel.classList.toggle('hidden');
                });
            }

            logService.debug('Debug panel initialized');
        } catch (error) {
            logService.error('Failed to initialize debug panel:', error);
            throw error;
        }
    }

    initializeTooltips() {
        try {
            const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            tooltips.forEach(tooltip => {
                new bootstrap.Tooltip(tooltip);
            });
            logService.debug('Tooltips initialized');
        } catch (error) {
            logService.error('Failed to initialize tooltips:', error);
        }
    }

    initializeModals() {
        try {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                new bootstrap.Modal(modal);
            });
            logService.debug('Modals initialized');
        } catch (error) {
            logService.error('Failed to initialize modals:', error);
        }
    }

    async setupEventListeners() {
        try {
            // Theme change listener
            if (themeService && typeof themeService.addThemeChangeListener === 'function') {
                themeService.addThemeChangeListener(theme => {
                    this.updateComponentThemes(theme);
                });
            }

            // Language change listener
            if (i18nService && typeof i18nService.addLanguageChangeListener === 'function') {
                i18nService.addLanguageChangeListener(() => {
                    this.updateComponentLanguages();
                });
            }

            logService.debug('Event listeners setup complete');
        } catch (error) {
            logService.error('Failed to setup event listeners:', error);
            // Don't throw here, just log the error
        }
    }

    updateComponentThemes(theme) {
        try {
            document.body.setAttribute('data-theme', theme);
            this.components.forEach(component => {
                if (component.updateTheme) {
                    component.updateTheme(theme);
                }
            });
            logService.debug('Component themes updated', { theme });
        } catch (error) {
            logService.error('Failed to update component themes:', error);
        }
    }

    updateComponentLanguages() {
        try {
            this.components.forEach(component => {
                if (component.updateLanguage) {
                    component.updateLanguage();
                }
            });
            logService.debug('Component languages updated');
        } catch (error) {
            logService.error('Failed to update component languages:', error);
        }
    }

    registerComponent(id, component) {
        if (!this.initialized) {
            throw new Error('Cannot register component before initialization');
        }

        try {
            this.components.set(id, component);
            logService.debug('Component registered', { id });
        } catch (error) {
            logService.error('Failed to register component:', error);
            throw error;
        }
    }

    getComponent(id) {
        return this.components.get(id);
    }

    cleanup() {
        if (!this.initialized) return;

        try {
            logService.debug('Cleaning up UIComponentService...');
            
            // Cleanup components
            this.components.forEach(component => {
                if (component.cleanup) {
                    component.cleanup();
                }
            });
            
            this.components.clear();
            this.initialized = false;
            
            logService.debug('UIComponentService cleaned up successfully');
        } catch (error) {
            logService.error('Error during cleanup:', error);
        }
    }
}

export const uiComponentService = new UIComponentService(); 