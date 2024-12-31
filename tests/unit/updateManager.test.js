import { updateManagerService } from '../../services/UpdateManagerService.js';
import { logService } from '../../services/LogService.js';

describe('Update Manager', () => {
    let updateManager;

    beforeEach(() => {
        updateManager = new updateManagerService();
        fetch.mockClear();
    });

    test('should check for updates', async () => {
        fetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                tag_name: 'v1.1.0',
                body: 'Test release notes',
                zipball_url: 'test-url'
            })
        }));

        const updateInfo = await updateManager.checkForUpdates();
        expect(updateInfo.hasUpdate).toBe(true);
        expect(updateInfo.latestVersion).toBe('v1.1.0');
    });

    test('should compare versions correctly', () => {
        expect(updateManager.compareVersions('v1.1.0', '1.0.0')).toBe(true);
        expect(updateManager.compareVersions('v1.0.0', '1.0.0')).toBe(false);
        expect(updateManager.compareVersions('v0.9.0', '1.0.0')).toBe(false);
    });

    test('should handle download errors', async () => {
        fetch.mockRejectedValueOnce(new Error('Download failed'));
        
        await expect(updateManager.downloadUpdate('test-url'))
            .rejects
            .toThrow('Nie udało się pobrać aktualizacji');
    });
}); 