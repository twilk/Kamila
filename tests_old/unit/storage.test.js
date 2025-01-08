import { STORAGE_KEYS, saveToStorage, getFromStorage, removeFromStorage, getStorageInfo, clearStorage } from '../../services/storage.js';

describe('Storage Service', () => {
    beforeEach(async () => {
        await clearStorage();
    });

    describe('STORAGE_KEYS', () => {
        test('should have all required keys', () => {
            expect(STORAGE_KEYS).toHaveProperty('CACHE');
            expect(STORAGE_KEYS).toHaveProperty('LAST_UPDATE');
            expect(STORAGE_KEYS).toHaveProperty('STORE_DATA');
            expect(STORAGE_KEYS).toHaveProperty('SELECTED_STORE');
            expect(STORAGE_KEYS).toHaveProperty('SELECTED_USER');
            expect(STORAGE_KEYS).toHaveProperty('DEBUG_MODE');
        });

        test('STORE_DATA should generate correct key', () => {
            expect(STORAGE_KEYS.STORE_DATA('test')).toBe('darwina_store_test');
            expect(STORAGE_KEYS.STORE_DATA()).toBe('darwina_store_ALL');
        });
    });

    describe('saveToStorage', () => {
        test('should save data correctly', async () => {
            const testData = { test: 'data' };
            await saveToStorage('test_key', testData);
            const result = await chrome.storage.local.get('test_key');
            expect(result.test_key).toEqual(testData);
        });

        test('should handle large objects', async () => {
            const largeData = Array(1000).fill({ data: 'test'.repeat(100) });
            await expect(saveToStorage('large_data', largeData)).resolves.not.toThrow();
        });

        test('should throw on invalid data', async () => {
            const circularData = { a: {} };
            circularData.a.b = circularData;
            await expect(saveToStorage('circular', circularData)).rejects.toThrow();
        });
    });

    describe('getFromStorage', () => {
        test('should retrieve saved data', async () => {
            const testData = { test: 'data' };
            await chrome.storage.local.set({ test_key: testData });
            const result = await getFromStorage('test_key');
            expect(result).toEqual(testData);
        });

        test('should return null for non-existent key', async () => {
            const result = await getFromStorage('non_existent');
            expect(result).toBeNull();
        });
    });

    describe('removeFromStorage', () => {
        test('should remove data', async () => {
            await chrome.storage.local.set({ test_key: 'data' });
            await removeFromStorage('test_key');
            const result = await chrome.storage.local.get('test_key');
            expect(result.test_key).toBeUndefined();
        });

        test('should not throw for non-existent key', async () => {
            await expect(removeFromStorage('non_existent')).resolves.not.toThrow();
        });
    });

    describe('getStorageInfo', () => {
        test('should return storage usage info', async () => {
            const info = await getStorageInfo();
            expect(info).toHaveProperty('bytesInUse');
            expect(info).toHaveProperty('quotaBytes');
            expect(typeof info.bytesInUse).toBe('number');
            expect(typeof info.quotaBytes).toBe('number');
        });
    });

    describe('clearStorage', () => {
        test('should clear all data', async () => {
            await chrome.storage.local.set({
                key1: 'data1',
                key2: 'data2'
            });
            await clearStorage();
            const result = await chrome.storage.local.get(null);
            expect(Object.keys(result).length).toBe(0);
        });
    });
}); 