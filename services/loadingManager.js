import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';

export class LoadingManager extends BaseManager {
    constructor() {
        super();
        this.loaders = new Map();
        this.loaderIdCounter = 0;
    }

    async initialize() {
        try {
            await super.initialize();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    showLoader(targetElement, customTemplate = null) {
        try {
            if (!targetElement) {
                throw new Error('Target element is required');
            }

            // Generate unique ID for this loader
            const loaderId = `loader-${++this.loaderIdCounter}`;

            // Create loader element
            const loaderElement = document.createElement('div');
            loaderElement.id = loaderId;
            loaderElement.className = 'loader-container';

            if (customTemplate) {
                loaderElement.innerHTML = customTemplate;
            } else {
                loaderElement.innerHTML = `
                    <div class="loader-wrapper">
                        <div class="loader-circle"></div>
                        <div class="loader-circle"></div>
                        <div class="loader-circle"></div>
                        <div class="loader-shadow"></div>
                        <div class="loader-shadow"></div>
                        <div class="loader-shadow"></div>
                    </div>
                `;
            }

            // Store reference to original content
            const originalContent = targetElement.innerHTML;
            this.loaders.set(loaderId, {
                element: loaderElement,
                target: targetElement,
                originalContent
            });

            // Show loader
            targetElement.innerHTML = '';
            targetElement.appendChild(loaderElement);

            return loaderId;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'showLoader',
                target: targetElement?.id || 'unknown'
            });
            return null;
        }
    }

    hideLoader(loaderId) {
        try {
            const loader = this.loaders.get(loaderId);
            if (!loader) {
                throw new Error(`Loader with ID ${loaderId} not found`);
            }

            // Restore original content
            loader.target.innerHTML = loader.originalContent;

            // Remove loader reference
            this.loaders.delete(loaderId);

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'hideLoader',
                loaderId
            });
            return false;
        }
    }

    hideAllLoaders() {
        try {
            // Create a copy of loader IDs to avoid modification during iteration
            const loaderIds = Array.from(this.loaders.keys());
            
            // Hide each loader
            loaderIds.forEach(id => this.hideLoader(id));
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'hideAllLoaders'
            });
            return false;
        }
    }

    updateLoader(loaderId, template) {
        try {
            const loader = this.loaders.get(loaderId);
            if (!loader) {
                throw new Error(`Loader with ID ${loaderId} not found`);
            }

            loader.element.innerHTML = template;
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateLoader',
                loaderId
            });
            return false;
        }
    }

    isLoading(loaderId) {
        return this.loaders.has(loaderId);
    }

    getActiveLoaders() {
        return Array.from(this.loaders.keys());
    }

    dispose() {
        try {
            this.hideAllLoaders();
            this.loaders.clear();
            this.loaderIdCounter = 0;
            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 