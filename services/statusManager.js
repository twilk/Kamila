import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';
import { i18n } from './i18n.js';

export class StatusManager extends BaseManager {
    constructor(eventManager) {
        super();
        this.eventManager = eventManager;
        this.leadCounts = null;
        this.statusElements = new Map();
        this.updateCallbacks = new Set();
        this.statusIndicators = new Map();
    }

    async onInitialize() {
        try {
            await this.setupEventListeners();
            await this.loadLeadCounts();
            await this.initializeStatusElements();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    setupEventListeners() {
        try {
            // Status indicator clicks
            this.eventManager.delegate('click', '[data-status-action]', async (event, target) => {
                const action = target.dataset.statusAction;
                if (action) {
                    await this.handleStatusAction(action);
                }
            });

            // Status refresh on hover
            this.eventManager.delegate('mouseenter', '.status-indicator', async (event, target) => {
                const status = target.dataset.status;
                if (status) {
                    await this.refreshStatus(status);
                }
            }, { throttle: 1000 });

            // Lead count clicks
            this.eventManager.delegate('click', '[data-lead-status]', async (event, target) => {
                const status = target.dataset.leadStatus;
                if (status) {
                    await this.handleLeadStatusClick(status, target);
                }
            });

            // Status tooltip initialization
            this.eventManager.delegate('mouseover', '[data-status-tooltip]', (event, target) => {
                const tooltipText = target.dataset.statusTooltip;
                if (tooltipText && typeof bootstrap !== 'undefined') {
                    const tooltip = bootstrap.Tooltip.getInstance(target) || 
                                  new bootstrap.Tooltip(target, {
                                      title: tooltipText,
                                      placement: 'top',
                                      trigger: 'hover'
                                  });
                }
            });

        } catch (error) {
            this.handleError(error, ErrorType.EVENT, ErrorSeverity.ERROR, {
                method: 'setupEventListeners'
            });
        }
    }

    async initializeStatusElements() {
        try {
            // Initialize status elements
            const statusContainers = document.querySelectorAll('[data-status]');
            statusContainers.forEach(container => {
                const status = container.getAttribute('data-status');
                if (status) {
                    this.statusElements.set(status, container);
                    
                    // Initialize status indicator
                    const indicator = container.querySelector('.status-indicator');
                    if (indicator) {
                        this.statusIndicators.set(status, indicator);
                    }
                }
            });

            // Initial status update
            await this.updateAllStatuses();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeStatusElements'
            });
        }
    }

    async loadLeadCounts() {
        try {
            const { leadCounts } = await chrome.storage.local.get('leadCounts');
            this.leadCounts = leadCounts || {};
            return this.leadCounts;
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.ERROR, {
                method: 'loadLeadCounts'
            });
            return {};
        }
    }

    async updateLeadCounts(newCounts, oldCounts = null) {
        try {
            if (!oldCounts) {
                oldCounts = this.leadCounts || {};
            }

            // Update stored counts
            this.leadCounts = newCounts;
            await chrome.storage.local.set({ leadCounts: newCounts });

            // Update UI elements
            Object.entries(newCounts).forEach(([status, count]) => {
                const element = this.statusElements.get(status);
                if (element) {
                    // Update count
                    const countElement = element.querySelector('.count');
                    if (countElement) {
                        countElement.textContent = count;
                        countElement.classList.toggle('count-zero', count === 0);
                    }

                    // Add animation if count changed
                    const oldCount = oldCounts[status] || 0;
                    if (count !== oldCount) {
                        element.classList.add('count-changed');
                        setTimeout(() => {
                            element.classList.remove('count-changed');
                        }, 1000);

                        // Show notification for important changes
                        if ((status === '1' || status === '2') && count > oldCount) {
                            this.showNotification(status, oldCount, count);
                        }
                    }
                }
            });

            // Notify listeners
            this.notifyUpdateListeners(newCounts, oldCounts);
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.ERROR, {
                method: 'updateLeadCounts',
                newCounts,
                oldCounts
            });
        }
    }

    async showNotification(status, oldCount, newCount) {
        try {
            await chrome.notifications.create(`status-update-${status}`, {
                type: 'basic',
                iconUrl: 'icon128.png',
                title: i18n.translate('statusUpdate'),
                message: i18n.translate('statusChangeFormat', {
                    status: status,
                    previous: oldCount,
                    current: newCount
                }),
                priority: 1
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'showNotification',
                status,
                oldCount,
                newCount
            });
        }
    }

    async updateAllStatuses(fullTest = false) {
        try {
            const updates = [];
            this.statusElements.forEach((element, status) => {
                updates.push(this.updateStatus(status, element, fullTest));
            });

            await Promise.all(updates);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'updateAllStatuses',
                fullTest
            });
        }
    }

    async updateStatus(status, element, fullTest = false) {
        try {
            const count = this.leadCounts?.[status] || 0;
            const countElement = element.querySelector('.count');
            if (countElement) {
                countElement.textContent = count;
                countElement.classList.toggle('count-zero', count === 0);
            }

            // Update status indicator
            const indicator = this.statusIndicators.get(status);
            if (indicator) {
                indicator.classList.toggle('active', count > 0);
                indicator.classList.toggle('warning', fullTest && count === 0);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateStatus',
                status,
                fullTest
            });
        }
    }

    async handleStatusAction(action) {
        try {
            switch (action) {
                case 'refresh':
                    await this.updateAllStatuses(true);
                    break;
                case 'clear':
                    await this.clearStatuses();
                    break;
                default:
                    throw new Error(`Unknown status action: ${action}`);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'handleStatusAction',
                action
            });
        }
    }

    async clearStatuses() {
        try {
            this.leadCounts = {};
            await chrome.storage.local.remove('leadCounts');
            await this.updateAllStatuses();
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.ERROR, {
                method: 'clearStatuses'
            });
        }
    }

    async refreshStatus(status) {
        try {
            const element = this.statusElements.get(status);
            if (element) {
                const indicator = this.statusIndicators.get(status);
                if (indicator) {
                    indicator.classList.add('refreshing');
                }

                await this.updateStatus(status, element, true);

                if (indicator) {
                    indicator.classList.remove('refreshing');
                }
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'refreshStatus',
                status
            });
        }
    }

    addUpdateListener(callback) {
        this.updateCallbacks.add(callback);
        return () => this.updateCallbacks.delete(callback);
    }

    notifyUpdateListeners(newCounts, oldCounts) {
        this.updateCallbacks.forEach(callback => {
            try {
                callback(newCounts, oldCounts);
            } catch (error) {
                this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.WARNING, {
                    method: 'notifyUpdateListeners',
                    callback: callback.name
                });
            }
        });
    }

    async dispose() {
        try {
            this.updateCallbacks.clear();
            this.statusElements.clear();
            this.statusIndicators.clear();
            this.leadCounts = null;

            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 