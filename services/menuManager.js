import { UIManager } from './core/UIManager.js';
import { i18n } from './i18n.js';

/**
 * @extends {UIManager}
 * Manager responsible for menu functionality
 */
export class MenuManager extends UIManager {
    /**
     * @type {NodeListOf<Element>}
     * @private
     */
    _menuLinks = null;

    /**
     * @type {Array<any>}
     * @private
     */
    _tooltipList = [];

    /**
     * @param {typeof i18n} i18nService - i18n service instance
     */
    constructor(i18nService) {
        super([i18nService], []); // Core dependencies: i18n, no UI dependencies
    }

    /**
     * Implementation specific initialization
     * @protected
     * @returns {Promise<void>}
     */
    async _doInitialize() {
        console.log('🔄 Inicjalizuję menu...');
        this._menuLinks = document.querySelectorAll('.menu .link');
        await this._initializeMenuEvents();
        await this._updateMenuItems();
        await this._initializeTooltips();
    }

    /**
     * Implementation specific disposal
     * @protected
     * @returns {Promise<void>}
     */
    async _doDispose() {
        // Usuń tooltips
        if (this._tooltipList.length > 0) {
            this._tooltipList.forEach(tooltip => {
                try {
                    tooltip?.dispose();
                } catch (e) {
                    // Ignoruj błędy przy usuwaniu tooltipów
                }
            });
            this._tooltipList = [];
        }
    }

    /**
     * Inicjalizuje obsługę zdarzeń menu
     * @private
     */
    async _initializeMenuEvents() {
        this._menuLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Usuń klasę active z wszystkich linków
                this._menuLinks.forEach(l => l.classList.remove('active'));
                
                // Dodaj klasę active do klikniętego linku
                link.classList.add('active');
                
                // Pokaż odpowiednią zakładkę
                const targetId = link.getAttribute('data-target');
                if (targetId) {
                    const tabPanes = document.querySelectorAll('.tab-pane');
                    tabPanes.forEach(pane => {
                        pane.classList.remove('show', 'active');
                    });
                    
                    const targetPane = document.querySelector(targetId);
                    if (targetPane) {
                        targetPane.classList.add('show', 'active');
                    }
                }
            });
        });
    }

    /**
     * Aktualizuje teksty w menu na podstawie aktualnego języka
     * @private
     */
    async _updateMenuItems() {
        console.log('🔄 Aktualizuję elementy menu...');
        const menuItems = document.querySelectorAll('.menu .link');
        menuItems.forEach(item => {
            const menuText = item.querySelector('.menu-text');
            if (menuText) {
                const key = menuText.getAttribute('data-i18n');
                if (key) {
                    console.log(`📝 Aktualizuję tekst menu dla klucza: ${key}`);
                    menuText.textContent = i18n.translate(key);
                }
            }
        });
    }

    /**
     * Inicjalizuje tooltips dla elementów menu
     * @private
     */
    async _initializeTooltips() {
        console.log('🔄 Inicjalizuję tooltips...');
        
        try {
            // Sprawdź czy bootstrap jest dostępny
            if (typeof bootstrap === 'undefined') {
                console.warn('⚠️ Bootstrap nie jest załadowany - tooltips nie będą działać');
                return;
            }

            // Usuń stare tooltips
            if (this._tooltipList.length > 0) {
                this._tooltipList.forEach(tooltip => {
                    try {
                        tooltip?.dispose();
                    } catch (e) {
                        // Ignoruj błędy przy usuwaniu tooltipów
                    }
                });
                this._tooltipList = [];
            }

            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            tooltipTriggerList.forEach(element => {
                try {
                    const tooltipKey = element.getAttribute('data-i18n-tooltip');
                    if (tooltipKey) {
                        console.log(`📝 Ustawiam tooltip dla klucza: ${tooltipKey}`);
                        element.setAttribute('title', i18n.translate(`tooltips.${tooltipKey}`));
                        const tooltip = new bootstrap.Tooltip(element, {
                            animation: true,
                            delay: { show: 100, hide: 100 },
                            placement: 'auto',
                            trigger: 'hover focus'
                        });
                        this._tooltipList.push(tooltip);
                    }
                } catch (error) {
                    console.error('❌ Błąd inicjalizacji tooltipa:', error);
                }
            });
        } catch (error) {
            console.error('❌ Błąd inicjalizacji tooltipów:', error);
        }
    }

    /**
     * Wymusza aktualizację elementów menu
     * @public
     * @returns {Promise<void>}
     */
    async refreshMenu() {
        if (!this.isInitialized()) {
            throw new Error('MenuManager is not initialized');
        }
        await this._updateMenuItems();
        await this._initializeTooltips();
    }
} 