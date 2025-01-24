import { LogLevel } from './LogLevel.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';

/**
 * Utility class for validating manager dependencies and detecting circular references
 */
export class DependencyValidator {
    /**
     * Map of all manager dependencies
     * @type {Map<string, Set<string>>}
     */
    #dependencyMap = new Map();

    /**
     * Map of reverse dependencies (who depends on whom)
     * @type {Map<string, Set<string>>}
     */
    #reverseDependencyMap = new Map();

    /**
     * Add a manager and its dependencies to the validation map
     * @param {string} managerName - Name of the manager
     * @param {string[]} dependencies - Array of dependency names
     */
    addDependencies(managerName, dependencies) {
        // Initialize sets if they don't exist
        if (!this.#dependencyMap.has(managerName)) {
            this.#dependencyMap.set(managerName, new Set());
        }

        // Add dependencies
        dependencies.forEach(dep => {
            this.#dependencyMap.get(managerName).add(dep);

            // Add reverse dependency
            if (!this.#reverseDependencyMap.has(dep)) {
                this.#reverseDependencyMap.set(dep, new Set());
            }
            this.#reverseDependencyMap.get(dep).add(managerName);
        });
    }

    /**
     * Check for circular dependencies
     * @returns {{ hasCircular: boolean, path: string[] }} Result object with circular dependency info
     */
    detectCircularDependencies() {
        const visited = new Set();
        const recursionStack = new Set();
        const circularPath = [];

        const dfs = (manager, path = []) => {
            if (recursionStack.has(manager)) {
                circularPath.push(...path.slice(path.indexOf(manager)), manager);
                return true;
            }

            if (visited.has(manager)) {
                return false;
            }

            visited.add(manager);
            recursionStack.add(manager);
            path.push(manager);

            const dependencies = this.#dependencyMap.get(manager) || new Set();
            for (const dep of dependencies) {
                if (dfs(dep, path)) {
                    return true;
                }
            }

            path.pop();
            recursionStack.delete(manager);
            return false;
        };

        // Check each manager
        for (const manager of this.#dependencyMap.keys()) {
            if (dfs(manager)) {
                return {
                    hasCircular: true,
                    path: circularPath
                };
            }
        }

        return {
            hasCircular: false,
            path: []
        };
    }

    /**
     * Get all managers that depend on a given manager
     * @param {string} managerName - Name of the manager
     * @returns {Set<string>} Set of dependent manager names
     */
    getDependentManagers(managerName) {
        return this.#reverseDependencyMap.get(managerName) || new Set();
    }

    /**
     * Get all dependencies for a given manager
     * @param {string} managerName - Name of the manager
     * @returns {Set<string>} Set of dependency names
     */
    getDependencies(managerName) {
        return this.#dependencyMap.get(managerName) || new Set();
    }

    /**
     * Get optimal initialization order
     * @returns {string[]} Array of manager names in optimal initialization order
     */
    getInitializationOrder() {
        const visited = new Set();
        const order = [];

        const visit = (manager) => {
            if (visited.has(manager)) return;

            visited.add(manager);

            // First initialize all dependencies
            const dependencies = this.#dependencyMap.get(manager) || new Set();
            for (const dep of dependencies) {
                visit(dep);
            }

            order.push(manager);
        };

        // Visit all managers
        for (const manager of this.#dependencyMap.keys()) {
            visit(manager);
        }

        return order;
    }

    /**
     * Print dependency tree for debugging
     * @returns {string} Formatted dependency tree
     */
    printDependencyTree() {
        let output = 'Dependency Tree:\n';

        const printNode = (manager, level = 0, visited = new Set()) => {
            const indent = '  '.repeat(level);
            output += `${indent}${manager}\n`;

            if (visited.has(manager)) {
                output += `${indent}  (circular reference)\n`;
                return;
            }

            visited.add(manager);
            const dependencies = this.#dependencyMap.get(manager) || new Set();
            for (const dep of dependencies) {
                printNode(dep, level + 1, new Set(visited));
            }
        };

        for (const manager of this.#dependencyMap.keys()) {
            if (!this.getDependentManagers(manager).size) {
                // Start with root nodes (those with no dependents)
                printNode(manager);
            }
        }

        return output;
    }

    /**
     * Clear all dependencies
     */
    clear() {
        this.#dependencyMap.clear();
        this.#reverseDependencyMap.clear();
    }
}

// Export singleton instance
export const dependencyValidator = new DependencyValidator(); 