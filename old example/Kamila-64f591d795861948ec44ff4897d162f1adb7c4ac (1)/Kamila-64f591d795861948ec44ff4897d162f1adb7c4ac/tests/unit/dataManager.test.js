import { DataManager } from '../../services/dataManager.js';
import { STORAGE_KEYS, saveToStorage, getFromStorage } from '../../services/storage.js';
import { progressManager } from '../../services/progressService.js';
import { i18n } from '../../services/i18nService.js';
import { API } from '../../services/index.js';

// Mocks
jest.mock('../../services/storage.js');
jest.mock('../../services/progressService.js');
jest.mock('../../services/i18nService.js');
jest.mock('../../services/index.js');

describe('DataManager', () => {
    let dataManager;
    let mockUiManager;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock UI Manager
        mockUiManager = {
            updateLeadCount: jest.fn(),
            showError: jest.fn(),
            updateStoreSelect: jest.fn(),
            updateUserSelect: jest.fn()
        };

        // Mock i18n
        i18n.translate = jest.fn(key => key);

        // Mock progressManager
        progressManager.show = jest.fn();
        progressManager.setProgress = jest.fn();
        progressManager.setSuccess = jest.fn();
        progressManager.setError = jest.fn();
        progressManager.hide = jest.fn();

        // Create instance
        dataManager = new DataManager(mockUiManager);
    });

    describe('refreshData', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2024-01-01'));
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should not refresh if data is recent', async () => {
            // Mock recent update
            getFromStorage.mockResolvedValue(Date.now() - 200000); // 3.33 minutes ago

            await dataManager.refreshData();

            expect(API.fetchData).not.toHaveBeenCalled();
            expect(progressManager.show).not.toHaveBeenCalled();
        });

        test('should refresh if force=true even with recent data', async () => {
            getFromStorage.mockResolvedValue(Date.now());
            API.fetchData.mockResolvedValue({ leads: [] });

            await dataManager.refreshData(true);

            expect(API.fetchData).toHaveBeenCalled();
            expect(saveToStorage).toHaveBeenCalledWith(STORAGE_KEYS.LAST_UPDATE, expect.any(Number));
        });

        test('should handle API error correctly', async () => {
            const error = new Error('API Error');
            API.fetchData.mockRejectedValue(error);

            await dataManager.refreshData(true);

            expect(progressManager.setError).toHaveBeenCalled();
            expect(mockUiManager.showError).toHaveBeenCalled();
        });

        test('should update UI with new data', async () => {
            const mockData = {
                leads: [
                    { status: '1' },
                    { status: '1' },
                    { status: '2' },
                    { status: 'READY' }
                ]
            };
            API.fetchData.mockResolvedValue(mockData);

            await dataManager.refreshData(true);

            expect(mockUiManager.updateLeadCount).toHaveBeenCalledWith('1', 2);
            expect(mockUiManager.updateLeadCount).toHaveBeenCalledWith('2', 1);
            expect(mockUiManager.updateLeadCount).toHaveBeenCalledWith('READY', 1);
        });
    });

    describe('updateLeadCounts', () => {
        test('should handle empty data', () => {
            dataManager.updateLeadCounts(null);
            expect(mockUiManager.updateLeadCount).not.toHaveBeenCalled();
        });

        test('should count leads correctly', () => {
            const data = {
                leads: [
                    { status: '1' },
                    { status: '2' },
                    { status: '2' },
                    { status: 'READY' },
                    { status: 'OVERDUE' },
                    { status: 'INVALID' } // should be ignored
                ]
            };

            dataManager.updateLeadCounts(data);

            expect(mockUiManager.updateLeadCount).toHaveBeenCalledWith('1', 1);
            expect(mockUiManager.updateLeadCount).toHaveBeenCalledWith('2', 2);
            expect(mockUiManager.updateLeadCount).toHaveBeenCalledWith('READY', 1);
            expect(mockUiManager.updateLeadCount).toHaveBeenCalledWith('OVERDUE', 1);
        });

        test('should save counts to storage', () => {
            const data = {
                leads: [
                    { status: '1' },
                    { status: '2' }
                ]
            };

            dataManager.updateLeadCounts(data);

            expect(saveToStorage).toHaveBeenCalledWith(
                STORAGE_KEYS.LEAD_COUNTS,
                expect.objectContaining({
                    '1': 1,
                    '2': 1,
                    '3': 0,
                    'READY': 0,
                    'OVERDUE': 0
                })
            );
        });
    });

    describe('getStores', () => {
        test('should fetch and update stores', async () => {
            const mockStores = [{ id: 1, name: 'Store 1' }];
            API.getStores.mockResolvedValue(mockStores);

            const result = await dataManager.getStores();

            expect(result).toEqual(mockStores);
            expect(mockUiManager.updateStoreSelect).toHaveBeenCalledWith(mockStores);
        });

        test('should handle error', async () => {
            API.getStores.mockRejectedValue(new Error('API Error'));

            const result = await dataManager.getStores();

            expect(result).toEqual([]);
            expect(mockUiManager.showError).toHaveBeenCalled();
        });
    });

    describe('getUsers', () => {
        test('should fetch and update users', async () => {
            const mockUsers = [{ id: 1, name: 'User 1' }];
            API.getUsers.mockResolvedValue(mockUsers);

            const result = await dataManager.getUsers();

            expect(result).toEqual(mockUsers);
            expect(mockUiManager.updateUserSelect).toHaveBeenCalledWith(mockUsers);
        });

        test('should handle error', async () => {
            API.getUsers.mockRejectedValue(new Error('API Error'));

            const result = await dataManager.getUsers();

            expect(result).toEqual([]);
            expect(mockUiManager.showError).toHaveBeenCalled();
        });
    });
}); 