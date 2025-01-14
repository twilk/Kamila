import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';

export class MenuManager extends BaseManager {
    constructor(eventManager) {
        super();
        this.eventManager = eventManager;
        this.activeTab = null;
        this.tabs = new Map();
    }

    async onInitialize() {
        await this.setupEventListeners();
        await this.initializeTabs();
        return true;
    }

    setupEventListeners() {
        try {
            // Tab switching
            this.eventManager.delegate('click', '[data-tab]', (event, target) => {
                event.preventDefault();
                this.switchTab(target.dataset.tab);
            });

            // Menu toggling
            this.eventManager.delegate('click', '.menu-toggle', (event, target) => {
                const menu = document.querySelector('.menu');
                if (menu) {
                    menu.classList.toggle('expanded');
                    target.classList.toggle('active');
                }
            });

            // Submenu toggling
            this.eventManager.delegate('click', '.submenu-toggle', (event, target) => {
                const submenu = target.nextElementSibling;
                if (submenu) {
                    const isExpanded = submenu.classList.toggle('expanded');
                    target.classList.toggle('active', isExpanded);
                    target.setAttribute('aria-expanded', isExpanded);
                }
            });

            // Close menu on outside click
            this.eventManager.delegate('click', 'body', (event, target) => {
                const menu = document.querySelector('.menu');
                const menuToggle = document.querySelector('.menu-toggle');
                
                if (menu && menu.classList.contains('expanded') && 
                    !menu.contains(event.target) && 
                    !menuToggle.contains(event.target)) {
                    menu.classList.remove('expanded');
                    menuToggle.classList.remove('active');
                }
            });

            // Handle keyboard navigation
            this.eventManager.delegate('keydown', '[data-tab]', (event, target) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.switchTab(target.dataset.tab);
                }
            });

        } catch (error) {
            this.handleError(error, ErrorType.EVENT, ErrorSeverity.ERROR, {
                method: 'setupEventListeners'
            });
        }
    }

    async initializeTabs() {
        try {
            // Initialize tab states
            document.querySelectorAll('[data-tab]').forEach(tab => {
                const tabId = tab.dataset.tab;
                const content = document.querySelector(`[data-tab-content="${tabId}"]`);
                
                if (content) {
                    this.tabs.set(tabId, {
                        tab,
                        content,
                        initialized: false
                    });
                }
            });

            // Set initial active tab
            const activeTab = document.querySelector('[data-tab].active');
            if (activeTab) {
                await this.switchTab(activeTab.dataset.tab);
            } else {
                const firstTab = this.tabs.keys().next().value;
                if (firstTab) {
                    await this.switchTab(firstTab);
                }
            }

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.ERROR, {
                method: 'initializeTabs'
            });
            return false;
        }
    }

    async switchTab(tabId) {
        try {
            const tabData = this.tabs.get(tabId);
            if (!tabData) return false;

            // Deactivate current tab
            if (this.activeTab) {
                const currentTab = this.tabs.get(this.activeTab);
                if (currentTab) {
                    currentTab.tab.classList.remove('active');
                    currentTab.content.classList.remove('active');
                }
            }

            // Activate new tab
            tabData.tab.classList.add('active');
            tabData.content.classList.add('active');
            this.activeTab = tabId;

            // Initialize tab content if needed
            if (!tabData.initialized) {
                await this.initializeTabContent(tabId);
                tabData.initialized = true;
            }

            // Update URL hash
            history.replaceState(null, null, `#${tabId}`);

            // Emit tab change event
            this.emit('tabChange', { 
                tabId, 
                previousTab: this.activeTab 
            });

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'switchTab',
                tabId
            });
            return false;
        }
    }

    async initializeTabContent(tabId) {
        try {
            const tabData = this.tabs.get(tabId);
            if (!tabData) return false;

            // Initialize tab-specific content
            switch (tabId) {
                case 'dashboard':
                    await this.initializeDashboard(tabData.content);
                    break;
                case 'ranking':
                    await this.initializeRanking(tabData.content);
                    break;
                case 'settings':
                    await this.initializeSettings(tabData.content);
                    break;
                // Add more tab initializations as needed
            }

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.ERROR, {
                method: 'initializeTabContent',
                tabId
            });
            return false;
        }
    }

    async initializeDashboard(content) {
        // Initialize dashboard-specific content
        this.emit('dashboardInit', { content });
    }

    async initializeRanking(content) {
        // Initialize ranking-specific content
        this.emit('rankingInit', { content });
    }

    async initializeSettings(content) {
        // Initialize settings-specific content
        this.emit('settingsInit', { content });
    }

    getActiveTab() {
        return this.activeTab;
    }

    isTabInitialized(tabId) {
        const tabData = this.tabs.get(tabId);
        return tabData ? tabData.initialized : false;
    }

    async dispose() {
        // Clear tab data
        this.tabs.clear();
        this.activeTab = null;

        await super.dispose();
    }
} 