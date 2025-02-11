import { BaseManager } from './BaseManager.js';
import { LogLevel } from './LogLevel.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';

/**
 * Represents a group of managers that can be initialized in parallel
 */
export class ManagerGroup {
    /**
     * @type {Map<string, BaseManager>}
     */
    #managers = new Map();

    /**
     * @type {Set<string>}
     */
    #dependencies = new Set();

    /**
     * @type {string}
     */
    #name;

    /**
     * Create a new manager group
     * @param {string} name Group name
     */
    constructor(name) {
        this.#name = name;
    }

    /**
     * Add a manager to the group
     * @param {string} name Manager name
     * @param {BaseManager} manager Manager instance
     * @param {string[]} dependencies Manager dependencies
     */
    addManager(name, manager, dependencies = []) {
        if (!(manager instanceof BaseManager)) {
            throw new Error(`Invalid manager instance for ${name}`);
        }
        this.#managers.set(name, manager);
        dependencies.forEach(dep => this.#dependencies.add(dep));
    }

    /**
     * Get all dependencies for this group
     * @returns {string[]} Array of dependency names
     */
    getDependencies() {
        return Array.from(this.#dependencies);
    }

    /**
     * Get all managers in this group
     * @returns {Map<string, BaseManager>} Map of manager names to instances
     */
    getManagers() {
        return this.#managers;
    }

    /**
     * Get group name
     * @returns {string} Group name
     */
    getName() {
        return this.#name;
    }

    /**
     * Initialize all managers in this group in parallel
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        const startTime = performance.now();
        const initPromises = [];

        // Get descriptive name based on managers in the group
        const getGroupType = () => {
            const managerNames = Array.from(this.#managers.keys());
            if (managerNames.some(name => ['errorhandler', 'eventmanager', 'loadingmanager', 'connectionmanager', 'cachemanager', 'uimanager', 'debugmanager'].includes(name.toLowerCase()))) {
                return 'Core Services';
            } else if (managerNames.some(name => ['thememanager', 'operationprogressmanager', 'menumanager', 'volumemanager', 'notificationmanager'].includes(name.toLowerCase()))) {
                return 'Base Managers';
            } else if (managerNames.some(name => ['datamanager', 'storemanager', 'statusmanager', 'usermanager', 'languagemanager', 'updatemanager', 'refreshmanager', 'rankingmanager'].includes(name.toLowerCase()))) {
                return 'Feature Managers';
            }
            return 'API Services';
        };

        for (const [name, manager] of this.#managers) {
            initPromises.push(
                manager.initialize()
                    .then(success => ({ name, success }))
                    .catch(error => ({ name, success: false, error }))
            );
        }

        try {
            const results = await Promise.all(initPromises);
            const duration = performance.now() - startTime;
            
            // Check if any initialization failed
            const failures = results.filter(r => !r.success);
            if (failures.length > 0) {
                const failureNames = failures.map(f => f.name).join(', ');
                throw new Error(`Failed to initialize managers: ${failureNames}`);
            }

            const groupType = getGroupType();
            console.log(`✅ ${groupType} initialized in ${duration.toFixed(2)}ms`);
            return true;
        } catch (error) {
            const groupType = getGroupType();
            console.error(`❌ Failed to initialize ${groupType}:`, error);
            return false;
        }
    }
}

/**
 * Creates optimal groups of managers for parallel initialization
 */
export class ManagerGrouper {
    /**
     * @type {Map<string, BaseManager>}
     */
    #managers;

    /**
     * @type {Map<string, string[]>}
     */
    #dependencies;

    constructor(managers, dependencies) {
        this.#managers = managers;
        this.#dependencies = dependencies;
    }

    /**
     * Create groups of managers that can be initialized in parallel
     * @returns {ManagerGroup[]} Array of manager groups
     */
    createGroups() {
        const visited = new Set();
        const groups = [];
        let currentGroup = null;

        // Helper function to check if all dependencies are initialized
        const areDependenciesMet = (name) => {
            const deps = this.#dependencies.get(name) || [];
            return deps.every(dep => visited.has(dep));
        };

        // Process managers until all are grouped
        while (visited.size < this.#managers.size) {
            const availableManagers = Array.from(this.#managers.keys())
                .filter(name => !visited.has(name) && areDependenciesMet(name));

            if (availableManagers.length === 0) {
                throw new Error('Circular dependency detected');
            }

            // Create new group for this level
            currentGroup = new ManagerGroup(`Group${groups.length + 1}`);

            // Add all available managers to current group
            for (const name of availableManagers) {
                currentGroup.addManager(
                    name,
                    this.#managers.get(name),
                    this.#dependencies.get(name) || []
                );
                visited.add(name);
            }

            groups.push(currentGroup);
        }

        return groups;
    }
} 