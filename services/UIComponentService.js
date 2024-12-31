import { logService } from './LogService.js';
import { i18nService } from './I18nService.js';
import { darwinaService } from './DarwinaService.js';

export class UIComponentService {
    constructor() {
        this.initialized = false;
        this.stores = [];
    }

    async initialize() {
        if (this.initialized) return;

        try {
            logService.info('Initializing UI components...');
            await this.initializeComponents();
            this.showUIElements();
            this.initialized = true;
            logService.info('UI components initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize UI components:', error);
            throw error;
        }
    }

    showUIElements() {
        try {
            // Pokaż główny kontener
            const mainContainer = document.getElementById('main-container');
            if (mainContainer) {
                mainContainer.classList.remove('hidden');
            }

            // Pokaż liczniki
            document.querySelectorAll('.lead-count').forEach(counter => {
                counter.classList.remove('hidden');
            });

            // Pokaż aktywną zakładkę
            const activeTab = document.querySelector('.tab-pane.active');
            if (activeTab) {
                activeTab.classList.remove('hidden');
            }

            logService.debug('UI elements shown successfully');
        } catch (error) {
            logService.error('Failed to show UI elements:', error);
            throw error;
        }
    }

    async initializeComponents() {
        try {
            // Pobierz listę sklepów
            this.stores = await darwinaService.getStores();
            
            // Inicjalizuj komponenty UI
            this.initializeRefreshButton();
            this.initializeDebugPanel();
            this.initializeTooltips();
            this.updateInterface();
            
            // Załaduj dane
            await this.refreshData();
        } catch (error) {
            logService.error('Failed to initialize components:', error);
            throw error;
        }
    }

    initializeRefreshButton() {
        const refreshButton = document.getElementById('refresh-store-data');
        if (!refreshButton) {
            logService.warn('Refresh button not found');
            return;
        }

        refreshButton.addEventListener('click', async () => {
            try {
                refreshButton.disabled = true;
                await this.refreshData();
            } catch (error) {
                logService.error('Failed to refresh data:', error);
            } finally {
                refreshButton.disabled = false;
            }
        });
    }

    initializeDebugPanel() {
        const debugPanel = document.getElementById('debug-panel');
        if (!debugPanel) {
            logService.warn('Debug panel not found');
            return;
        }

        const debugEnabled = localStorage.getItem('debugMode') === 'true';
        if (debugEnabled) {
            debugPanel.classList.remove('hidden');
            document.body.classList.add('debug-enabled');
        }
    }

    initializeTooltips() {
        try {
            if (typeof bootstrap === 'undefined' || !bootstrap.Tooltip) {
                logService.warn('Bootstrap Tooltip not available');
                return;
            }

            const tooltips = document.querySelectorAll('[data-toggle="tooltip"]');
            tooltips.forEach(tooltip => {
                new bootstrap.Tooltip(tooltip);
            });
        } catch (error) {
            logService.error('Failed to initialize tooltips:', error);
        }
    }

    updateInterface() {
        try {
            document.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                if (key) {
                    element.textContent = i18nService.translate(key);
                }
            });
        } catch (error) {
            logService.error('Failed to update interface:', error);
        }
    }

    async refreshData() {
        try {
            const data = await darwinaService.getData();
            if (!data) {
                throw new Error('No data received from API');
            }
            this.updateCounters(data);
            this.updateTables(data);
        } catch (error) {
            logService.error('Failed to refresh data:', error);
            throw error;
        }
    }

    updateCounters(data) {
        if (!data) return;

        // Aktualizuj liczniki statusów
        const counters = {
            'count-submitted': data.submitted || 0,
            'count-confirmed': data.confirmed || 0,
            'count-accepted': data.accepted || 0,
            'count-ready': data.ready || 0
        };

        Object.entries(counters).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    updateTables(data) {
        if (!data) return;

        try {
            // Aktualizuj tabele z danymi
            const ordersContainer = document.querySelector('.orders-list');
            const stockContainer = document.querySelector('.stock-list');

            if (ordersContainer && Array.isArray(data.orders)) {
                ordersContainer.innerHTML = this.generateOrdersTable(data.orders);
            }

            if (stockContainer && Array.isArray(data.stock)) {
                stockContainer.innerHTML = this.generateStockTable(data.stock);
            }
        } catch (error) {
            logService.error('Failed to update tables:', error);
            throw error;
        }
    }

    generateOrdersTable(orders) {
        if (!Array.isArray(orders)) {
            logService.warn('Invalid orders data');
            return '<div class="alert alert-warning">No orders data available</div>';
        }

        return `<table class="table">
            <thead>
                <tr>
                    <th>${i18nService.translate('orderNumber')}</th>
                    <th>${i18nService.translate('status')}</th>
                    <th>${i18nService.translate('date')}</th>
                </tr>
            </thead>
            <tbody>
                ${orders.map(order => `
                    <tr>
                        <td>${order?.number || '-'}</td>
                        <td>${order?.status || '-'}</td>
                        <td>${order?.date ? new Date(order.date).toLocaleString() : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
    }

    generateStockTable(stock) {
        if (!Array.isArray(stock)) {
            logService.warn('Invalid stock data');
            return '<div class="alert alert-warning">No stock data available</div>';
        }

        return `<table class="table">
            <thead>
                <tr>
                    <th>${i18nService.translate('product')}</th>
                    <th>${i18nService.translate('quantity')}</th>
                    <th>${i18nService.translate('lastUpdate')}</th>
                </tr>
            </thead>
            <tbody>
                ${stock.map(item => `
                    <tr>
                        <td>${item?.name || '-'}</td>
                        <td>${item?.quantity ?? '-'}</td>
                        <td>${item?.lastUpdate ? new Date(item.lastUpdate).toLocaleString() : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
    }
}

export const uiComponentService = new UIComponentService(); 