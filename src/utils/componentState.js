export class ComponentState {
    constructor() {
        this.states = new Map();
        this.loadingStates = new Map();
        this.errors = new Map();
        this.listeners = new Set();
    }

    setLoading(component, isLoading) {
        this.loadingStates.set(component, isLoading);
        this.notifyListeners();
    }

    setError(component, error) {
        this.errors.set(component, error);
        this.notifyListeners();
    }

    setReady(component) {
        this.states.set(component, true);
        this.loadingStates.set(component, false);
        this.errors.delete(component);
        this.notifyListeners();
    }

    isLoading(component) {
        return this.loadingStates.get(component) || false;
    }

    getError(component) {
        return this.errors.get(component);
    }

    isReady(component) {
        return this.states.get(component) || false;
    }

    areAllReady(components) {
        return components.every(component => this.isReady(component));
    }

    getLoadingComponents() {
        return Array.from(this.loadingStates.entries())
            .filter(([_, isLoading]) => isLoading)
            .map(([component]) => component);
    }

    getComponentsWithErrors() {
        return Array.from(this.errors.keys());
    }

    onStateChange(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notifyListeners() {
        this.listeners.forEach(callback => callback({
            ready: Array.from(this.states.entries()),
            loading: Array.from(this.loadingStates.entries()),
            errors: Array.from(this.errors.entries())
        }));
    }

    reset() {
        this.states.clear();
        this.loadingStates.clear();
        this.errors.clear();
        this.notifyListeners();
    }
} 