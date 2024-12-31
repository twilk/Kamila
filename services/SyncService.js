import { logService } from './LogService.js';
import { cacheService } from './CacheService.js';
import { performanceMonitorService } from './PerformanceMonitorService.js';
import { requestQueue } from './RequestQueueService.js';

/**
 * Serwis do synchronizacji danych
 */
class SyncService {
    constructor() {
        this.syncInProgress = false;
        this.lastSync = null;
        this.syncInterval = 5 * 60 * 1000; // 5 minut
        this.retryDelay = 30 * 1000; // 30 sekund
        this.maxRetries = 3;
        this.pendingChanges = new Map();
        this.conflictResolutionStrategies = new Map();
    }

    /**
     * Inicjalizuje serwis synchronizacji
     */
    async init() {
        // Wczytaj ostatnią synchronizację
        const result = await chrome.storage.local.get('lastSync');
        if (result.lastSync) {
            this.lastSync = new Date(result.lastSync);
        }

        // Ustaw alarm dla regularnej synchronizacji
        chrome.alarms.create('sync', {
            periodInMinutes: 5
        });

        // Nasłuchuj alarmu
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === 'sync') {
                this.sync();
            }
        });

        // Nasłuchuj zmian online/offline
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        logService.info('SyncService initialized');
    }

    /**
     * Rozpoczyna synchronizację
     */
    async sync() {
        if (this.syncInProgress) {
            logService.warn('Sync already in progress');
            return;
        }

        this.syncInProgress = true;
        logService.info('Starting sync');

        try {
            // Pobierz zmiany lokalne
            const localChanges = await this.getLocalChanges();
            
            // Pobierz zmiany zdalne
            const remoteChanges = await this.fetchRemoteChanges();

            // Wykryj konflikty
            const conflicts = this.detectConflicts(localChanges, remoteChanges);

            if (conflicts.length > 0) {
                // Rozwiąż konflikty
                await this.resolveConflicts(conflicts);
            }

            // Wyślij zmiany na serwer
            await this.pushChanges(localChanges);

            // Pobierz najnowsze dane
            await this.pullChanges(remoteChanges);

            // Aktualizuj cache
            await this.updateCache();

            this.lastSync = new Date();
            await chrome.storage.local.set({ lastSync: this.lastSync.toISOString() });

            logService.info('Sync completed successfully');
            performanceMonitorService.metrics.sync = {
                lastSync: this.lastSync,
                status: 'success'
            };
        } catch (error) {
            logService.error('Sync failed', { error });
            performanceMonitorService.metrics.sync = {
                lastSync: this.lastSync,
                status: 'error'
            };

            // Zaplanuj ponowną próbę
            this.scheduleRetry();
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Pobiera lokalne zmiany
     * @returns {Array} Lista zmian
     */
    async getLocalChanges() {
        const changes = Array.from(this.pendingChanges.values());
        logService.debug('Got local changes', { count: changes.length });
        return changes;
    }

    /**
     * Pobiera zdalne zmiany
     * @returns {Array} Lista zmian
     */
    async fetchRemoteChanges() {
        const lastSyncTime = this.lastSync ? this.lastSync.toISOString() : null;
        
        try {
            const response = await requestQueue.enqueue({
                url: '/api/changes',
                options: {
                    method: 'GET',
                    headers: {
                        'If-Modified-Since': lastSyncTime
                    }
                },
                priority: 1
            });

            logService.debug('Got remote changes', { count: response.length });
            return response;
        } catch (error) {
            logService.error('Error fetching remote changes', { error });
            throw error;
        }
    }

    /**
     * Wykrywa konflikty między zmianami
     * @param {Array} localChanges Zmiany lokalne
     * @param {Array} remoteChanges Zmiany zdalne
     * @returns {Array} Lista konfliktów
     */
    detectConflicts(localChanges, remoteChanges) {
        const conflicts = [];

        for (const localChange of localChanges) {
            const remoteChange = remoteChanges.find(
                change => change.id === localChange.id
            );

            if (remoteChange && this.isConflicting(localChange, remoteChange)) {
                conflicts.push({
                    local: localChange,
                    remote: remoteChange
                });
            }
        }

        logService.debug('Detected conflicts', { count: conflicts.length });
        return conflicts;
    }

    /**
     * Sprawdza czy zmiany są w konflikcie
     * @param {Object} local Zmiana lokalna
     * @param {Object} remote Zmiana zdalna
     * @returns {boolean} Czy jest konflikt
     */
    isConflicting(local, remote) {
        return local.version !== remote.version;
    }

    /**
     * Rozwiązuje konflikty
     * @param {Array} conflicts Lista konfliktów
     */
    async resolveConflicts(conflicts) {
        for (const conflict of conflicts) {
            const strategy = this.conflictResolutionStrategies.get(conflict.type) || 
                           this.defaultConflictResolution;
            
            await strategy(conflict);
        }

        logService.info('Resolved conflicts', { count: conflicts.length });
    }

    /**
     * Domyślna strategia rozwiązywania konfliktów
     * @param {Object} conflict Konflikt
     */
    defaultConflictResolution(conflict) {
        // Domyślnie wybierz wersję zdalną
        return conflict.remote;
    }

    /**
     * Wysyła zmiany na serwer
     * @param {Array} changes Lista zmian
     */
    async pushChanges(changes) {
        if (changes.length === 0) {
            return;
        }

        try {
            await requestQueue.enqueue({
                url: '/api/changes',
                options: {
                    method: 'POST',
                    body: JSON.stringify(changes)
                },
                priority: 1
            });

            this.pendingChanges.clear();
            logService.info('Changes pushed successfully', { count: changes.length });
        } catch (error) {
            logService.error('Error pushing changes', { error });
            throw error;
        }
    }

    /**
     * Pobiera zmiany z serwera
     * @param {Array} changes Lista zmian
     */
    async pullChanges(changes) {
        if (changes.length === 0) {
            return;
        }

        try {
            // Aplikuj zmiany lokalnie
            for (const change of changes) {
                await this.applyChange(change);
            }

            logService.info('Changes pulled successfully', { count: changes.length });
        } catch (error) {
            logService.error('Error pulling changes', { error });
            throw error;
        }
    }

    /**
     * Aplikuje zmianę lokalnie
     * @param {Object} change Zmiana
     */
    async applyChange(change) {
        // Zaktualizuj dane w cache
        await cacheService.set(change.key, change.data);
        
        // Wyemituj zdarzenie o zmianie
        this.emitChange(change);
    }

    /**
     * Aktualizuje cache
     */
    async updateCache() {
        await cacheService.cleanup();
        logService.debug('Cache updated');
    }

    /**
     * Planuje ponowną próbę synchronizacji
     */
    scheduleRetry() {
        setTimeout(() => {
            if (!this.syncInProgress) {
                this.sync();
            }
        }, this.retryDelay);
    }

    /**
     * Obsługuje przejście w tryb online
     */
    handleOnline() {
        logService.info('Device is online');
        this.sync();
    }

    /**
     * Obsługuje przejście w tryb offline
     */
    handleOffline() {
        logService.warn('Device is offline');
        this.syncInProgress = false;
    }

    /**
     * Dodaje zmianę do kolejki
     * @param {Object} change Zmiana
     */
    queueChange(change) {
        this.pendingChanges.set(change.id, change);
        logService.debug('Change queued', { change });
    }

    /**
     * Dodaje strategię rozwiązywania konfliktów
     * @param {string} type Typ konfliktu
     * @param {Function} strategy Funkcja rozwiązująca konflikt
     */
    addConflictResolutionStrategy(type, strategy) {
        this.conflictResolutionStrategies.set(type, strategy);
    }

    /**
     * Emituje zdarzenie o zmianie
     * @param {Object} change Zmiana
     */
    emitChange(change) {
        chrome.runtime.sendMessage({
            type: 'SYNC_CHANGE',
            payload: change
        });
    }
}

// Eksportuj singleton
export const syncService = new SyncService(); 