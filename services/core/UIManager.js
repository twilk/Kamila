import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { BaseManager } from './BaseManager.js';

/**
 * @extends {BaseManager}
 * Base class for UI-related managers
 */
export class UIManager extends BaseManager {
    /**
     * @protected
     * @type {Array<UIManager>}
     */
    _uiDependencies = [];

    /**
     * @param {Array<IInitializable>} coreDependencies - Core service dependencies
     * @param {Array<UIManager>} [uiDependencies=[]] - UI manager dependencies
     */
    constructor(coreDependencies, uiDependencies = []) {
        super(coreDependencies);
        this._uiDependencies = uiDependencies;
        this.tooltips = new Set();
        this.modals = new Set();
    }

    /**
     * Initialize UI manager and its dependencies
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            await super.initialize();

            // Initialize tooltips
            await this.initializeTooltips();

            // Initialize modals
            await this.initializeModals();

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    /**
     * Initialize tooltips
     * @returns {Promise<void>}
     */
    async initializeTooltips() {
        try {
            if (typeof bootstrap === 'undefined') {
                throw new Error('Bootstrap is not loaded');
            }

            // Clear existing tooltips
            this.tooltips.forEach(tooltip => {
                try {
                    tooltip?.dispose();
                } catch (e) {
                    this.handleError(e, ErrorType.UI, ErrorSeverity.WARNING, {
                        method: 'initializeTooltips',
                        action: 'dispose'
                    });
                }
            });
            this.tooltips.clear();

            // Initialize new tooltips
            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            tooltipTriggerList.forEach(el => {
                try {
                    const tooltip = new bootstrap.Tooltip(el, {
                        animation: true,
                        delay: { show: 100, hide: 100 },
                        placement: 'auto'
                    });
                    this.tooltips.add(tooltip);
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                        method: 'initializeTooltips',
                        element: el
                    });
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initializeTooltips'
            });
            throw error;
        }
    }

    /**
     * Initialize modals
     * @returns {Promise<void>}
     */
    async initializeModals() {
        try {
            if (typeof bootstrap === 'undefined') {
                throw new Error('Bootstrap is not loaded');
            }

            // Clear existing modals
            this.modals.forEach(modal => {
                try {
                    modal?.dispose();
                } catch (e) {
                    this.handleError(e, ErrorType.UI, ErrorSeverity.WARNING, {
                        method: 'initializeModals',
                        action: 'dispose'
                    });
                }
            });
            this.modals.clear();

            // Initialize new modals
            document.querySelectorAll('.modal').forEach(el => {
                try {
                    const modal = new bootstrap.Modal(el, {
                        backdrop: 'static',
                        keyboard: false
                    });
                    this.modals.add(modal);
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                        method: 'initializeModals',
                        element: el
                    });
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initializeModals'
            });
            throw error;
        }
    }

    /**
     * Cleanup and dispose of the UI manager
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            // Dispose tooltips
            this.tooltips.forEach(tooltip => {
                try {
                    tooltip?.dispose();
                } catch (e) {
                    this.handleError(e, ErrorType.UI, ErrorSeverity.WARNING, {
                        method: 'dispose',
                        component: 'tooltip'
                    });
                }
            });
            this.tooltips.clear();

            // Dispose modals
            this.modals.forEach(modal => {
                try {
                    modal?.dispose();
                } catch (e) {
                    this.handleError(e, ErrorType.UI, ErrorSeverity.WARNING, {
                        method: 'dispose',
                        component: 'modal'
                    });
                }
            });
            this.modals.clear();

            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }

    /**
     * Add a UI dependency
     * @protected
     * @param {UIManager} dependency
     */
    _addUIDependency(dependency) {
        this._uiDependencies.push(dependency);
    }

    /**
     * Show a message
     * @param {string} type - Message type
     * @param {string} message - Message content
     */
    showMessage(type, message) {
        try {
            const messageElement = document.querySelector(`.${type}-message`);
            if (messageElement) {
                messageElement.textContent = message;
                messageElement.classList.remove('d-none');
            } else {
                throw new Error(`Message element of type ${type} not found`);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'showMessage',
                type,
                message
            });
        }
    }

    /**
     * Hide a message
     * @param {string} type - Message type
     */
    hideMessage(type) {
        try {
            const messageElement = document.querySelector(`.${type}-message`);
            if (messageElement) {
                messageElement.classList.add('d-none');
            } else {
                throw new Error(`Message element of type ${type} not found`);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'hideMessage',
                type
            });
        }
    }
} 