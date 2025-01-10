import { UIManager } from './components/uiManager.js';
import { DataManager } from './components/dataManager.js';
import { StatusManager } from './components/statusManager.js';
import { DebugManager } from './components/debugManager.js';
import { UpdateManager } from './components/updateManager.js';
import { UserManager } from './components/userManager.js';
import { InterfaceManager } from './components/interfaceManager.js';
import { i18n } from '../services/i18n.js';
import { progressManager, leadCountManager } from '../services/progressManager.js';
import testRunner from '../services/testRunner.js';

// Import tests
import '../tests/integration/translation.test.js';

class PopupManager {
    constructor() {
        console.log('🚀 Initializing PopupManager');
        this.uiManager = new UIManager();
        this.dataManager = new DataManager(this.uiManager);
        this.statusManager = new StatusManager();
        this.debugManager = new DebugManager(this.uiManager);
        this.updateManager = new UpdateManager(this.uiManager);
        this.userManager = new UserManager(this.uiManager);
        this.interfaceManager = new InterfaceManager(this.uiManager, this.dataManager, this.statusManager);
    }

    async initialize() {
        try {
            console.log('🚀 Initializing popup...');
            this.debugManager.logToPanel('🚀 Aplikacja uruchomiona');
            
            // Initialize translations
            await i18n.init();
            
            // Initialize UI components
            await this.initializeUIComponents();
            
            // Initialize test runner
            console.log('🧪 Setting up test runner...');
            const runButton = document.getElementById('run-all-tests');
            console.log('Run button found:', !!runButton);
            
            if (runButton) {
                runButton.addEventListener('click', async () => {
                    console.log('🧪 Run button clicked');
                    try {
                        console.log('🧪 Starting tests...');
                        const results = await testRunner.runAll();
                        console.log('🧪 Test results:', results);
                    } catch (error) {
                        console.error('🧪 Test error:', error);
                        this.debugManager.logToPanel('❌ Błąd podczas wykonywania testów', 'error', error);
                    }
                });
                console.log('🧪 Click handler attached to run button');
            } else {
                console.warn('🧪 Run button not found in DOM');
            }
            
            // Notify background script about popup opening
            await this.notifyPopupOpened();
            
            // Initial data fetch
            console.log('📡 Starting initial data fetch...');
            await this.dataManager.fetchDarwinaData();
            
            // Language initialization
            i18n.updateDataI18n();
            this.interfaceManager.updateInterface();
            this.debugManager.logToPanel('✅ Język zainicjalizowany', 'success');

            // Initialize tooltips
            this.uiManager.initializeTooltips();

            await this.userManager.updateUserCard();
            
            // Initialize debug mode
            this.debugManager.initializeDebugSwitch();
            this.debugManager.initializeDebugPanel();

            this.updateManager.initializeUpdateButton();

        } catch (error) {
            console.error('Error during initialization:', error);
            this.debugManager.logToPanel('❌ Błąd inicjalizacji', 'error', error);
        }
    }

    async initializeUIComponents() {
        try {
            // Initialize store select
            await this.interfaceManager.initializeStoreSelect();

            // Initialize tabs
            this.interfaceManager.initializeTabs();

            // Initialize language switcher
            this.interfaceManager.initializeLanguageSwitcher();
            
            // Initialize theme switcher
            this.interfaceManager.initializeThemeSwitcher();

            // Initialize user selector
            await this.userManager.initializeUserSelector();

            // Initialize status buttons
            this.interfaceManager.initializeStatusButtons();
            
            // First status check and counter update
            await this.statusManager.updateAllStatuses();

            // Initialize lead status links
            this.interfaceManager.initializeLeadStatusLinks();

            // Reset debug mode state at start
            document.body.classList.remove('debug-enabled');
            const debugSwitch = document.getElementById('debug-switch');
            if (debugSwitch) {
                debugSwitch.checked = false;
            }
            await chrome.storage.local.set({ debugMode: false });

        } catch (error) {
            console.error('Error initializing UI components:', error);
            this.debugManager.logToPanel('❌ Błąd podczas inicjalizacji komponentów UI', 'error', error);
        }
    }

    async notifyPopupOpened() {
        try {
            document.querySelectorAll('.lead-count').forEach(counter => {
                counter.textContent = '...';
                counter.classList.remove('count-error', 'count-zero');
            });

            // Try to get cached lead counts first
            let counts = await leadCountManager.getLeadCounts();
            let refreshNeeded = !counts;
            
            if (counts) {
                // Update UI with cached data first
                this.updateCountersUI(counts);
                
                // Check if we need a background refresh
                const lastUpdate = await chrome.storage.local.get('lastLeadCountUpdate');
                const now = Date.now();
                refreshNeeded = !lastUpdate.lastLeadCountUpdate || 
                              (now - lastUpdate.lastLeadCountUpdate) > leadCountManager.cacheTimeout;
            }

            if (refreshNeeded) {
                try {
                    progressManager.show('Aktualizacja liczników...');
                    counts = await leadCountManager.refreshLeadCounts();
                    if (counts) {
                        this.updateCountersUI(counts);
                        await chrome.storage.local.set({ lastLeadCountUpdate: Date.now() });
                        progressManager.setSuccess('Liczniki zaktualizowane');
                    }
                } catch (error) {
                    console.warn('Background refresh failed:', error);
                    if (!counts) {
                        // Only show error if we don't have any data to display
                        throw error;
                    }
                    // If we have cached data, just show a warning
                    progressManager.setWarning('Nie udało się odświeżyć liczników');
                }
            }
        } catch (error) {
            console.error('Error in notifyPopupOpened:', error);
            this.debugManager.logToPanel('❌ Błąd podczas ładowania liczników', 'error', error.message);
            progressManager.setError('Błąd aktualizacji liczników');
            
            document.querySelectorAll('.lead-count').forEach(counter => {
                counter.textContent = '-';
                counter.classList.add('count-error');
            });
        }
    }

    updateCountersUI(counts) {
        Object.entries(counts).forEach(([status, count]) => {
            const elementId = this.getCounterElementId(status);
            if (!elementId) {
                console.warn(`[WARNING] ⚠️ Nieznany status: ${status}`);
                return;
            }
            
            const counter = document.getElementById(elementId);
            if (counter) {
                console.log(`[DEBUG] 🔄 Aktualizuję licznik ${elementId}: ${count}`);
                counter.textContent = count;
                counter.classList.toggle('count-zero', count === 0);
                counter.classList.remove('count-error');
            } else {
                console.warn(`[WARNING] ⚠️ Nie znaleziono elementu o ID: ${elementId}`);
            }
        });
        this.debugManager.logToPanel('✅ Zaktualizowano liczniki', 'success');
    }

    getCounterElementId(status) {
        const statusMap = {
            '1': 'count-1',
            '2': 'count-2',
            '3': 'count-3',
            'READY': 'count-ready',
            'OVERDUE': 'count-overdue'
        };
        return statusMap[status];
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const popup = new PopupManager();
    popup.initialize();
}); 