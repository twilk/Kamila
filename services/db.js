import { logService } from './LogService.js';

/**
 * Service for database operations
 */
class DatabaseService {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.dbName = 'darwina_extension';
        this.dbVersion = 1;
        logService.info('DatabaseService constructed');
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            logService.info('Initializing DatabaseService...');
            await this.openDatabase();
            this.isInitialized = true;
            logService.info('DatabaseService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize DatabaseService', error);
            throw error;
        }
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                logService.error('Database error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                logService.info('Database opened successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                logService.info('Database upgrade needed');
                const db = event.target.result;
                this.createSchema(db);
            };
        });
    }

    createSchema(db) {
        try {
            logService.info('Creating initial database schema...');
            
            // Create object stores
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings');
            }
            if (!db.objectStoreNames.contains('cache')) {
                db.createObjectStore('cache');
            }
            if (!db.objectStoreNames.contains('user_data')) {
                db.createObjectStore('user_data');
            }

            logService.info('Initial schema created successfully');
        } catch (error) {
            logService.error('Failed to create initial schema', error);
            throw error;
        }
    }

    async get(key, store = 'settings') {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(store, 'readonly');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.get(key);

            request.onerror = () => {
                logService.error(`Error getting ${key} from ${store}`, request.error);
                reject(request.error);
            };

            request.onsuccess = () => resolve(request.result);
        });
    }

    async set(key, value, store = 'settings') {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(store, 'readwrite');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.put(value, key);

            request.onerror = () => {
                logService.error(`Error setting ${key} in ${store}`, request.error);
                reject(request.error);
            };

            request.onsuccess = () => resolve();
        });
    }

    async delete(key, store = 'settings') {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(store, 'readwrite');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.delete(key);

            request.onerror = () => {
                logService.error(`Error deleting ${key} from ${store}`, request.error);
                reject(request.error);
            };

            request.onsuccess = () => resolve();
        });
    }

    async clear(store = 'settings') {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(store, 'readwrite');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.clear();

            request.onerror = () => {
                logService.error(`Error clearing ${store}`, request.error);
                reject(request.error);
            };

            request.onsuccess = () => resolve();
        });
    }

    async getAll(store = 'settings') {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(store, 'readonly');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.getAll();

            request.onerror = () => {
                logService.error(`Error getting all from ${store}`, request.error);
                reject(request.error);
            };

            request.onsuccess = () => resolve(request.result);
        });
    }
}

// Create and export singleton instance
export const dbService = new DatabaseService(); 