import { ApiCache } from '@/services/cache';
import { CacheManager } from '@/services/cache';
import { sendLogToPopup } from '../../config/api.js';

// Dodajmy mocki dla cache
const mockCacheData = {
    testKey: {
        data: 'test-data',
        timestamp: Date.now()
    }
};

describe('Cache Tests', () => {
    beforeEach(() => {
        sendLogToPopup('🧪 Starting cache test', 'info');
        // Mockujemy localStorage
        const localStorageMock = {
            getItem: jest.fn(key => JSON.stringify(mockCacheData[key])),
            setItem: jest.fn(),
            clear: jest.fn(),
            removeItem: jest.fn()
        };
        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock
        });
    });

    test('Cache operations', async () => {
        try {
            // ... test code ...
            sendLogToPopup('✅ Cache operations test passed', 'success');
        } catch (error) {
            sendLogToPopup('❌ Cache operations test failed', 'error', error.message);
            throw error;
        }
    });
});
