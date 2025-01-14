import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';

export class LoadingManager extends BaseManager {
    constructor(eventManager) {
        super([eventManager]);
        this.eventManager = eventManager;
        this.loadingElement = null;
        this.loadingCount = 0;
    }

    async initialize() {
        try {
            await super.initialize();
            this.createLoadingElement();
            this.setupEventListeners();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initialize'
            });
            return false;
        }
    }

    setupEventListeners() {
        this.eventManager.on('loading:start', () => this.show());
        this.eventManager.on('loading:end', () => this.hide());
    }

    createLoadingElement() {
        if (!this.loadingElement) {
            this.loadingElement = document.createElement('div');
            this.loadingElement.className = 'loading-overlay d-none';
            this.loadingElement.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            `;
            document.body.appendChild(this.loadingElement);
        }
    }

    show() {
        this.loadingCount++;
        if (this.loadingElement && this.loadingCount > 0) {
            this.loadingElement.classList.remove('d-none');
        }
    }

    hide() {
        this.loadingCount = Math.max(0, this.loadingCount - 1);
        if (this.loadingElement && this.loadingCount === 0) {
            this.loadingElement.classList.add('d-none');
        }
    }

    async dispose() {
        try {
            if (this.loadingElement && this.loadingElement.parentNode) {
                this.loadingElement.parentNode.removeChild(this.loadingElement);
            }
            this.loadingElement = null;
            this.loadingCount = 0;
            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'dispose'
            });
        }
    }
} 