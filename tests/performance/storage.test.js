import { storageManager } from '../../services/core/StorageManager.js';

describe('Storage Performance Tests', () => {
    beforeEach(async () => {
        await storageManager.clear();
    });

    describe('Large Objects', () => {
        test('should handle 1MB object', async () => {
            // Create 1MB of data
            const data = Array(1024).fill('x'.repeat(1024)); // 1MB = 1024 * 1024 bytes
            
            const start = performance.now();
            await storageManager.save('large_data', data);
            const saveTime = performance.now() - start;
            
            const readStart = performance.now();
            const retrieved = await storageManager.load('large_data');
            const readTime = performance.now() - readStart;

            expect(retrieved).toEqual(data);
            expect(saveTime).toBeLessThan(1000); // Should take less than 1 second
            expect(readTime).toBeLessThan(500); // Should take less than 500ms
        });

        test('should handle multiple large objects', async () => {
            const data = Array(512).fill('x'.repeat(1024)); // 512KB
            const promises = [];

            // Save 10 large objects (total ~5MB)
            const start = performance.now();
            for (let i = 0; i < 10; i++) {
                promises.push(storageManager.save(`large_data_${i}`, data));
            }

            await Promise.all(promises);
            const totalTime = performance.now() - start;

            expect(totalTime).toBeLessThan(5000); // Should take less than 5 seconds
        });

        test('should handle quota exceeded gracefully', async () => {
            const data = Array(1024).fill('x'.repeat(1024)); // 1MB
            const promises = [];

            // Try to save more than 5MB (chrome.storage.local limit)
            for (let i = 0; i < 6; i++) {
                promises.push(storageManager.save(`overflow_${i}`, data));
            }

            await expect(Promise.all(promises)).rejects.toThrow();
        });
    });

    describe('Frequent Operations', () => {
        test('should handle rapid read/write operations', async () => {
            const operations = [];
            const start = performance.now();

            // Perform 100 rapid operations
            for (let i = 0; i < 100; i++) {
                operations.push(
                    storageManager.save(`key_${i}`, { data: i })
                        .then(() => storageManager.load(`key_${i}`))
                );
            }

            await Promise.all(operations);
            const totalTime = performance.now() - start;

            expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
        });

        test('should handle concurrent operations', async () => {
            const data = { test: 'data' };
            const operations = [];

            // Perform 50 concurrent writes and 50 concurrent reads
            for (let i = 0; i < 50; i++) {
                operations.push(storageManager.save(`concurrent_${i}`, data));
                operations.push(storageManager.load(`concurrent_${i}`));
            }

            const start = performance.now();
            await Promise.all(operations);
            const totalTime = performance.now() - start;

            expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
        });
    });

    describe('Storage Limits', () => {
        test('should warn when approaching storage limit', async () => {
            const warningThreshold = 4 * 1024 * 1024; // 4MB
            const data = Array(1024).fill('x'.repeat(1024)); // 1MB
            const consoleWarnSpy = jest.spyOn(console, 'warn');

            // Fill storage up to warning threshold
            for (let i = 0; i < 4; i++) {
                await storageManager.save(`warning_${i}`, data);
            }

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Storage usage above 80%')
            );
        });

        test('should handle storage cleanup', async () => {
            const data = Array(512).fill('x'.repeat(1024)); // 512KB
            
            // Fill storage with some data
            for (let i = 0; i < 8; i++) {
                await storageManager.save(`cleanup_${i}`, data);
            }

            // Clear storage
            const start = performance.now();
            await storageManager.clear();
            const clearTime = performance.now() - start;

            expect(clearTime).toBeLessThan(1000); // Should clear within 1 second
        });
    });
}); 