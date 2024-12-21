import { ThemeManager } from './theme.manager.js';
import { i18n } from './i18n.js';
import { accessibilityService } from './accessibility.js';

export class ThemePanel {
    constructor() {
        this.themeManager = ThemeManager.getInstance();
        this.panel = document.getElementById('theme-panel');
        this.overlay = document.getElementById('theme-panel-overlay');
        
        // Inicjalizacja stanu
        this.state = {
            isOpen: false,
            isDragging: false,
            startX: 0,
            currentX: 0
        };
        
        // Bind metod do instancji
        this.initializeColorInputs = this.initializeColorInputs.bind(this);
        this.initializeActionButtons = this.initializeActionButtons.bind(this);
        this.initializeKeyboardHandling = this.initializeKeyboardHandling.bind(this);
        this.initializeDragHandling = this.initializeDragHandling.bind(this);
        this.handleColorChange = this.handleColorChange.bind(this);
        this.saveColors = this.saveColors.bind(this);
        this.resetColors = this.resetColors.bind(this);
    }
    
    init() {
        // Inicjalizacja przycisków
        const editButton = document.getElementById('edit-theme');
        if (editButton) {
            editButton.addEventListener('click', () => this.togglePanel());
        }
        
        // Obsługa zamykania
        const closeButton = this.panel?.querySelector('.close-panel');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.closePanel());
        }
        
        // Obsługa kolorów
        this.initializeColorInputs();
        
        // Obsługa przycisków akcji
        this.initializeActionButtons();
        
        // Obsługa klawiszy
        this.initializeKeyboardHandling();
        
        // Obsługa przeciągania
        this.initializeDragHandling();
    }
    
    togglePanel() {
        if (this.state.isOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }
    
    openPanel() {
        if (!this.panel || !this.overlay) return;
        
        this.state.isOpen = true;
        this.panel.classList.add('show');
        this.overlay.classList.add('show');
        
        // Dostępność
        this.panel.setAttribute('aria-hidden', 'false');
        accessibilityService.announce(i18n.translate('screenReader.panelOpened'));
        
        // Użyj bezpośrednio AccessibilityService
        accessibilityService.createFocusTrap(this.panel);
    }
    
    closePanel() {
        if (!this.panel || !this.overlay) return;
        
        this.state.isOpen = false;
        this.panel.classList.remove('show');
        this.overlay.classList.remove('show');
        
        // Dostępność
        this.panel.setAttribute('aria-hidden', 'true');
        accessibilityService.announce(i18n.translate('screenReader.panelClosed'));
        
        // AccessibilityService automatycznie wyczyści focus trap
    }
    
    /**
     * Inicjalizuje obsługę kolorów
     */
    initializeColorInputs() {
        const primaryColor = document.getElementById('primary-color');
        const secondaryColor = document.getElementById('secondary-color');

        if (primaryColor && secondaryColor) {
            // Ustaw początkowe kolory
            const colors = this.themeManager.state.customColors;
            primaryColor.value = colors.primary;
            secondaryColor.value = colors.secondary;

            // Dodaj obsługę zdarzeń
            primaryColor.addEventListener('change', (e) => {
                this.handleColorChange('primary', e.target.value);
            });

            secondaryColor.addEventListener('change', (e) => {
                this.handleColorChange('secondary', e.target.value);
            });
        }
    }

    /**
     * Inicjalizuje obsługę przycisków akcji
     */
    initializeActionButtons() {
        const saveButton = document.getElementById('save-theme');
        const resetButton = document.getElementById('reset-theme');

        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveColors());
        }

        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetColors());
        }
    }

    /**
     * Inicjalizuje obsługę klawiatury
     */
    initializeKeyboardHandling() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.isOpen) {
                this.closePanel();
            }
        });
    }

    /**
     * Inicjalizuje obsługę przeciągania
     */
    initializeDragHandling() {
        if (!this.panel) return;

        this.panel.addEventListener('mousedown', (e) => {
            this.state.isDragging = true;
            this.state.startX = e.clientX;
            this.state.currentX = this.panel.offsetLeft;
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.state.isDragging) return;
            
            const dx = e.clientX - this.state.startX;
            const newX = Math.max(0, this.state.currentX + dx);
            
            this.panel.style.transform = `translateX(${newX}px)`;
        });

        document.addEventListener('mouseup', () => {
            this.state.isDragging = false;
        });
    }

    /**
     * Obsługuje zmianę koloru
     */
    handleColorChange(type, value) {
        const colors = { ...this.themeManager.state.customColors };
        colors[type] = value;
        this.themeManager.updateCustomColors(colors);
        
        const colorType = i18n.translate(`customTheme.${type}Color`).toLowerCase();
        accessibilityService.announce(
            i18n.translate('screenReader.colorChanged', { type: colorType, value })
        );
    }

    /**
     * Zapisuje wybrane kolory
     */
    saveColors() {
        const primaryColor = document.getElementById('primary-color');
        const secondaryColor = document.getElementById('secondary-color');

        if (primaryColor && secondaryColor) {
            const colors = {
                primary: primaryColor.value,
                secondary: secondaryColor.value
            };
            this.themeManager.updateCustomColors(colors);
            this.closePanel();
        }
    }

    /**
     * Resetuje kolory do domyślnych
     */
    resetColors() {
        const defaultColors = this.themeManager.resetColors();
        const primaryColor = document.getElementById('primary-color');
        const secondaryColor = document.getElementById('secondary-color');

        if (primaryColor && secondaryColor) {
            primaryColor.value = defaultColors.primary;
            secondaryColor.value = defaultColors.secondary;
        }
    }
} 