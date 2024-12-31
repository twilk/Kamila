import { logService } from './LogService.js';

/**
 * Service for managing loading states
 */
export class LoadingService {
    constructor() {
        this.initialized = false;
        this.loadingStates = new Map();
        this.pendingStates = [];
        logService.info('LoadingService constructed');
    }

    async initialize() {
        if (this.initialized) {
            logService.debug('LoadingService already initialized');
            return;
        }

        try {
            logService.info('Initializing LoadingService...');
            
            // Process any pending states
            while (this.pendingStates.length > 0) {
                const { id, isLoading } = this.pendingStates.shift();
                this.loadingStates.set(id, isLoading);
            }
            
            this.initialized = true;
            logService.info('LoadingService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize LoadingService', error);
            throw error;
        }
    }

    /**
     * Set loading state for a specific operation
     */
    setLoading(id, isLoading = true) {
        if (!this.initialized) {
            logService.debug('Queueing loading state change for after initialization', { id, isLoading });
            this.pendingStates.push({ id, isLoading });
            return;
        }

        try {
            this.loadingStates.set(id, isLoading);
            this._updateUI();
            logService.debug('Loading state updated', { id, isLoading });
        } catch (error) {
            logService.error('Failed to set loading state', error);
        }
    }

    /**
     * Check if any operation is in loading state
     */
    isLoading() {
        return Array.from(this.loadingStates.values()).some(state => state);
    }

    /**
     * Get loading state for a specific operation
     */
    getLoadingState(id) {
        return this.loadingStates.get(id) || false;
    }

    /**
     * Clear all loading states
     */
    clearLoadingStates() {
        try {
            this.loadingStates.clear();
            this._updateUI();
            logService.debug('All loading states cleared');
        } catch (error) {
            logService.error('Failed to clear loading states', error);
        }
    }

    /**
     * Update UI elements based on loading states
     */
    _updateUI() {
        const loadingContainer = document.getElementById('loading-container');
        if (!loadingContainer) return;

        if (this.isLoading()) {
            loadingContainer.classList.remove('hidden');
        } else {
            loadingContainer.classList.add('hidden');
        }
    }

    cleanup() {
        try {
            logService.debug('Cleaning up LoadingService...');
            this.loadingStates.clear();
            this.pendingStates = [];
            this.initialized = false;
            logService.debug('LoadingService cleaned up successfully');
        } catch (error) {
            logService.error('Error during cleanup', error);
        }
    }
}

export const loadingService = new LoadingService(); 