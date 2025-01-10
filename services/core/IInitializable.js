/**
 * @interface
 * Interface for components that require initialization
 */
export class IInitializable {
    /**
     * Initialize the component
     * @returns {Promise<boolean>} True if initialization was successful
     */
    async initialize() {
        throw new Error('Method not implemented');
    }

    /**
     * Dispose of the component's resources
     * @returns {Promise<boolean>} True if disposal was successful
     */
    async dispose() {
        throw new Error('Method not implemented');
    }

    /**
     * Check if component is initialized
     * @returns {boolean} True if component is initialized
     */
    isInitialized() {
        throw new Error('Method not implemented');
    }

    /**
     * Get initialization dependencies
     * @returns {Array<string>} Array of dependency names
     */
    getDependencies() {
        throw new Error('Method not implemented');
    }
} 