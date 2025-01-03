import { logService } from './LogService.js';
import { cacheManagerService } from './CacheManagerService.js';
import { stores } from '../config/stores.js';

// Google Sheets API configuration
const SPREADSHEET_ID = '1K4pOUtkNXJML6-T7YKufvZM5GEOIY5NAfK-NeciYsTo';
const SHEETS_API_BASE = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq`;

export class GoogleSheetsService {
    constructor() {
        this.initialized = false;
        logService.info('GoogleSheetsService constructed');
    }

    async initialize() {
        if (this.initialized) return;

        try {
            logService.info('Initializing GoogleSheetsService...');
            this.initialized = true;
            logService.info('GoogleSheetsService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize GoogleSheetsService:', error);
            throw error;
        }
    }

    async fetchSheetData(sheetName) {
        try {
            // Try cache first
            const cacheKey = `sheet_${sheetName}`;
            const cachedData = await cacheManagerService.get(cacheKey);
            if (cachedData) {
                logService.debug(`Cache hit for sheet ${sheetName}`);
                return cachedData;
            }

            logService.debug(`Fetching sheet data for ${sheetName}...`);
            // Używamy prostszego formatu URL
            const url = `${SHEETS_API_BASE}?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
            logService.debug('Fetching URL:', { url });

            try {
                const response = await fetch(url);
                logService.debug('Fetch response:', { 
                    status: response.status,
                    ok: response.ok,
                    headers: Object.fromEntries(response.headers.entries())
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
                }
                
                const text = await response.text();
                logService.debug('Response text length:', { length: text.length });
                
                if (!text || text.length === 0) {
                    throw new Error('Empty response from Google Sheets');
                }

                // Extract JSON from response
                const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\((.*)\)/);
                if (!jsonMatch) {
                    logService.error('Invalid response format:', { text });
                    throw new Error('Invalid response format from Google Sheets');
                }

                const jsonStr = jsonMatch[1];
                const data = JSON.parse(jsonStr);
                logService.debug('Parsed data:', { 
                    version: data.version,
                    status: data.status,
                    colCount: data.table?.cols?.length,
                    rowCount: data.table?.rows?.length
                });

                if (!data.table || !data.table.cols || !data.table.rows) {
                    throw new Error('Invalid data structure from Google Sheets');
                }

                // Convert data to our format
                const headers = data.table.cols.map(col => col.label || col.id);
                const rows = data.table.rows.map(row => {
                    if (!row.c) return Array(headers.length).fill('');
                    return row.c.map(cell => cell ? cell.v : '');
                });

                const result = { headers, rows };
                logService.debug('Converted data:', { 
                    headers,
                    rowCount: rows.length,
                    firstRow: rows[0]
                });

                // Cache the result
                await cacheManagerService.set(cacheKey, result, 5 * 60 * 1000);
                return result;

            } catch (fetchError) {
                logService.error('Fetch error:', { 
                    message: fetchError.message,
                    stack: fetchError.stack,
                    url 
                });
                throw fetchError;
            }

        } catch (error) {
            logService.error(`Error fetching sheet data for ${sheetName}:`, {
                error: error.message,
                stack: error.stack,
                url: SHEETS_API_BASE
            });
            throw error;
        }
    }

    validateSheetData(data) {
        const isValid = (
            data &&
            Array.isArray(data.headers) &&
            data.headers.length > 0 &&
            Array.isArray(data.rows) &&
            data.rows.every(row => Array.isArray(row) && row.length === data.headers.length)
        );

        logService.debug('Data validation:', {
            hasData: !!data,
            hasHeaders: data?.headers?.length > 0,
            hasRows: data?.rows?.length > 0,
            rowsMatchHeaders: data?.rows?.every(row => row.length === data?.headers?.length),
            isValid
        });

        return isValid;
    }

    async getDRWNData(storeId) {
        try {
            // Znajdź odpowiedni sklep i jego arkusz DRWN
            const store = stores.find(s => s.id === storeId);
            if (!store || !store.drwn) {
                logService.warn('No DRWN sheet configured for store:', { storeId });
                return [];
            }

            logService.debug('Getting DRWN data for store:', { storeId, drwnSheet: store.drwn });
            
            try {
                // Użyj nazwy arkusza z konfiguracji sklepu (store.drwn)
                const data = await this.fetchSheetData(store.drwn);
                
                if (!data || !data.rows || !data.headers) {
                    logService.error('Invalid DRWN data format:', { data });
                    return [];
                }

                logService.debug('Raw data:', { 
                    headers: data.headers,
                    firstRow: data.rows[0],
                    rowCount: data.rows.length
                });

                // Mapowanie kolumn z rzeczywistymi nazwami
                const codeIndex = data.headers.findIndex(h => h === 'Kod');
                const nameIndex = data.headers.findIndex(h => h === 'ProductName');
                const stockIndex = data.headers.findIndex(h => h === 'ShopStock');
                const magIndex = data.headers.findIndex(h => h === 'EVT Stock');
                const mczIndex = data.headers.findIndex(h => h === 'MCZ Stock');

                logService.debug('Column indices:', {
                    code: codeIndex,
                    name: nameIndex,
                    stock: stockIndex,
                    mag: magIndex,
                    mcz: mczIndex,
                    headers: data.headers
                });

                if (codeIndex === -1 || nameIndex === -1 || stockIndex === -1 || magIndex === -1 || mczIndex === -1) {
                    logService.error('Required columns not found:', {
                        headers: data.headers,
                        indices: { codeIndex, nameIndex, stockIndex, magIndex, mczIndex }
                    });
                    return [];
                }

                // Mapuj dane do formatu aplikacji
                const result = data.rows.map(row => {
                    const item = {
                        code: row[codeIndex]?.toString().trim() || '',
                        name: row[nameIndex]?.toString().trim() || '',
                        stock: parseFloat(row[stockIndex]) || 0,
                        mag: parseFloat(row[magIndex]) || 0,
                        drwn: parseFloat(row[mczIndex]) || 0
                    };
                    logService.debug('Mapped row:', { row, item });
                    return item;
                });

                logService.debug('Final result:', { result });
                return result;
            } catch (fetchError) {
                logService.error('Failed to fetch sheet data:', {
                    error: fetchError.message,
                    stack: fetchError.stack
                });
                return [];
            }
        } catch (error) {
            logService.error('Failed to get DRWN data:', {
                error: error.message,
                stack: error.stack
            });
            return [];
        }
    }

    async getRankingData() {
        try {
            const data = await this.fetchSheetData('Ranking');
            if (!data || !data.rows || !data.headers) {
                throw new Error('Invalid ranking data format');
            }

            // Konwertuj dane do formatu aplikacji
            const positionColumnIndex = data.headers.findIndex(h => h.toLowerCase().includes('pozycja'));
            const nameColumnIndex = data.headers.findIndex(h => h.toLowerCase().includes('imię'));

            return data.rows.map(row => ({
                position: parseInt(row[positionColumnIndex]) || 0,
                name: row[nameColumnIndex] || ''
            }));
        } catch (error) {
            logService.error('Failed to get ranking data:', error);
            return [];
        }
    }

    cleanup() {
        this.initialized = false;
        logService.debug('GoogleSheetsService cleaned up');
    }
}

export const googleSheetsService = new GoogleSheetsService(); 