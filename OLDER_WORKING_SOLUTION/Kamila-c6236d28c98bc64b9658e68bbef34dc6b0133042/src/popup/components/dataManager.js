import { AsyncOperationManager } from '../../utils/asyncOperationManager';
import { CacheManager } from '../../utils/cacheManager';
import { ComponentState } from '../../utils/componentState';
import { BenchmarkManager } from '../../utils/benchmarkManager';
import { DrwnService } from '../../services/drwn';
import { stores } from '../../config/stores';

export class DataManager {
    constructor() {
        this.asyncManager = new AsyncOperationManager();
        this.cacheManager = new CacheManager();
        this.componentState = new ComponentState();
        this.benchmarkManager = new BenchmarkManager();
        this.batchSize = 50;
    }

    async fetchDrwnDataBatch(store, offset, limit) {
        if (!store || !store.drwn) {
            throw new Error(`Brak danych DRWN dla sklepu ${store?.id || 'nieznanego'}`);
        }

        return await this.asyncManager.executeWithRetry(async () => {
            const { headers, rows } = await DrwnService.getSheetData(store.drwn);
            
            const startIndex = offset;
            const endIndex = Math.min(offset + limit, rows.length);
            const batchRows = rows.slice(startIndex, endIndex);

            const processedBatch = batchRows.map(row => ({
                code: row[1] || '',
                name: row[2] || '',
                shopStock: parseFloat(row[4] || '0'),
                drwnStock: parseFloat(row[6] || '0')
            })).filter(item => {
                if (!item.name || isNaN(item.shopStock) || isNaN(item.drwnStock)) {
                    return false;
                }

                const minGValue = this.getMinimumGValue(item.name);
                return item.shopStock <= 1 && item.drwnStock >= minGValue;
            });

            return {
                items: processedBatch,
                hasMore: endIndex < rows.length
            };
        });
    }

    getMinimumGValue(productName) {
        if (!productName) return 0;
        productName = productName.trim().toUpperCase();
        
        if (productName.endsWith('DRWN') && !productName.endsWith('DRWN2') && !productName.endsWith('DRWN3') && !productName.endsWith('DRWNG')) return 6;
        if (productName.endsWith('DRWN2')) return 3;
        if (productName.endsWith('DRWN3')) return 1;
        if (productName.endsWith('DRWNG')) return 2;
        return 0;
    }

    async updateDrwnData(selectedStore, onProgress = null) {
        this.componentState.setLoading('drwnData', true);
        this.benchmarkManager.start('drwnDataUpdate');

        try {
            if (!selectedStore || selectedStore === 'ALL') {
                this.updateDrwnUI({ items: [], clear: true });
                return [];
            }

            const store = stores.find(s => s.id === selectedStore);
            if (!store) {
                throw new Error(`Nieznany sklep: ${selectedStore}`);
            }

            const cacheKey = `drwn_data_${store.id}`;
            const cachedData = await this.cacheManager.get(cacheKey);
            if (cachedData) {
                this.updateDrwnUI({ items: cachedData, clear: true });
                return cachedData;
            }

            const data = await this.asyncManager.executeWithProgressiveLoading(
                async (offset, limit) => this.fetchDrwnDataBatch(store, offset, limit),
                {
                    batchSize: this.batchSize,
                    onProgress: (total, batch) => {
                        if (onProgress) {
                            onProgress(total, batch.items);
                        }
                        this.updateDrwnUI({ items: batch.items });
                    }
                }
            );

            await this.cacheManager.set(cacheKey, data);
            this.componentState.setReady('drwnData');
            return data;
        } catch (error) {
            console.error('Error updating DRWN data:', error);
            this.componentState.setError('drwnData', error);
            throw error;
        } finally {
            this.benchmarkManager.end('drwnDataUpdate');
            this.componentState.setLoading('drwnData', false);
        }
    }

    updateDrwnUI({ items, clear = false }) {
        const tbody = document.getElementById('drwn-body');
        if (!tbody) return;

        if (clear) {
            tbody.innerHTML = '';
        }

        if (items.length === 0 && clear) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Brak produktów spełniających warunki</td></tr>';
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td title="${item.code}">${item.code}</td>
                <td title="${item.name}">${item.name}</td>
                <td title="Stan w sklepie: ${item.shopStock}">${item.shopStock.toFixed(0)}</td>
                <td title="Stan DRWN: ${item.drwnStock}">${item.drwnStock.toFixed(0)}</td>
            `;
            fragment.appendChild(tr);
        });

        if (clear) {
            tbody.innerHTML = '';
        }
        tbody.appendChild(fragment);
    }

    async updateRankingData() {
        this.componentState.setLoading('rankingData', true);
        this.benchmarkManager.start('rankingDataUpdate');

        try {
            const SHEET_ID = '1gRAuqAbHrFR76Not6tjKLfvNz8FS_S2Uzo0GTQnMTWI';
            const SHEET_NAME = '2024-12';
            const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}&range=B:C`;

            const data = await this.asyncManager.executeWithRetry(async () => {
                const response = await fetch(url);
                const text = await response.text();
                const jsonData = JSON.parse(text.substring(47).slice(0, -2));
                
                return jsonData.table.rows
                    .map(row => ({
                        position: row.c[0]?.v || '',
                        name: row.c[1]?.v || ''
                    }))
                    .filter(item => item.position && item.name);
            });

            await this.cacheManager.set('rankingData', data);
            this.updateRankingUI(data);
            this.componentState.setReady('rankingData');
            return data;
        } catch (error) {
            console.error('Error updating ranking data:', error);
            this.componentState.setError('rankingData', error);
            throw error;
        } finally {
            this.benchmarkManager.end('rankingDataUpdate');
            this.componentState.setLoading('rankingData', false);
        }
    }

    updateRankingUI(data) {
        const tbody = document.querySelector('#ranking-data tbody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" class="text-center">Brak danych rankingu</td></tr>';
            return;
        }

        const fragment = document.createDocumentFragment();
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.position}</td>
                <td>${item.name}</td>
            `;
            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

    onStateChange(callback) {
        return this.componentState.onStateChange(callback);
    }

    isLoading(component) {
        return this.componentState.isLoading(component);
    }

    getError(component) {
        return this.componentState.getError(component);
    }

    isReady(component) {
        return this.componentState.isReady(component);
    }

    getBenchmarkReport() {
        return this.benchmarkManager.getReport();
    }
} 