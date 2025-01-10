import { API } from './index.js';
import { i18n } from './i18n.js';
import { ProgressManager } from './progressManager.js';
import { STORAGE_KEYS, saveToStorage, getFromStorage } from './storage.js';

export class DataManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.lastRefresh = 0;
    }

    async refreshData(force = false) {
        const now = Date.now();
        const lastUpdate = await getFromStorage(STORAGE_KEYS.LAST_UPDATE) || 0;
        
        if (!force && now - lastUpdate < 300000) { // 5 minut
            return;
        }

        try {
            progressManager.show(i18n.translate('logs.refreshingData'));
            progressManager.setProgress(30);

            // Pobierz dane z API
            const data = await API.fetchData();
            if (!data) {
                throw new Error('No data received from API');
            }

            // Zapisz timestamp ostatniej aktualizacji
            await saveToStorage(STORAGE_KEYS.LAST_UPDATE, now);
            this.lastRefresh = now;

            // Aktualizuj UI
            this.updateLeadCounts(data);
            
            progressManager.setSuccess(i18n.translate('logs.dataUpdated'));
            setTimeout(() => progressManager.hide(), 2000);

        } catch (error) {
            console.error('Error refreshing data:', error);
            progressManager.setError(i18n.translate('logs.dataFetchError'));
            this.uiManager.showError(i18n.translate('errors.dataRefresh'));
            setTimeout(() => progressManager.hide(), 3000);
        }
    }

    updateLeadCounts(data) {
        if (!data || !data.leads) return;

        const counts = {
            '1': 0,
            '2': 0,
            '3': 0,
            'READY': 0,
            'OVERDUE': 0
        };

        data.leads.forEach(lead => {
            if (counts.hasOwnProperty(lead.status)) {
                counts[lead.status]++;
            }
        });

        Object.entries(counts).forEach(([status, count]) => {
            this.uiManager.updateLeadCount(status, count);
        });

        // Zapisz liczniki do storage
        saveToStorage(STORAGE_KEYS.LEAD_COUNTS, counts).catch(error => {
            console.error('Error saving lead counts:', error);
        });
    }

    async getStores() {
        try {
            const stores = await API.getStores();
            this.uiManager.updateStoreSelect(stores);
            return stores;
        } catch (error) {
            console.error('Error fetching stores:', error);
            this.uiManager.showError(i18n.translate('errors.storesFetch'));
            return [];
        }
    }

    async getUsers() {
        try {
            const users = await API.getUsers();
            this.uiManager.updateUserSelect(users);
            return users;
        } catch (error) {
            console.error('Error fetching users:', error);
            this.uiManager.showError(i18n.translate('errors.usersFetch'));
            return [];
        }
    }
} 