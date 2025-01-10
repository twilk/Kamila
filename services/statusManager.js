import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';

export class StatusManager extends BaseManager {
    constructor() {
        super();
        this.leadCounts = null;
        this.statusElements = new Map();
        this.updateCallbacks = new Set();
    }

    async initialize() {
        try {
            await super.initialize();
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

    async initializeStatusElements() {
        try {
            // Initialize status elements
            const statusContainers = document.querySelectorAll('[data-status]');
            statusContainers.forEach(container => {
                const status = container.getAttribute('data-status');
                if (status) {
                    this.statusElements.set(status, container);
                }
            });
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
                    }

                    // Add animation if count changed
                    const oldCount = oldCounts[status] || 0;
                    if (count !== oldCount) {
                        element.classList.add('count-changed');
                        setTimeout(() => {
                            element.classList.remove('count-changed');
                        }, 1000);
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

    async updateAllStatuses(fullTest = false) {
        try {
            const statusElements = document.querySelectorAll('[data-status]');
            const updates = [];

            statusElements.forEach(element => {
                const status = element.getAttribute('data-status');
                if (status) {
                    updates.push(this.updateStatus(status, element, fullTest));
                }
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
            }

            // Update status indicator
            const indicator = element.querySelector('.status-indicator');
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

    dispose() {
        try {
            this.updateCallbacks.clear();
            this.statusElements.clear();
            this.leadCounts = null;
            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 