import { WallpaperManager } from '@/services/wallpaper';
import { sendLogToPopup } from '../../config/api.js';

// Mocki dla tapet
const mockWallpapers = {
    manifest: {
        defaultWallpaper: 'default',
        wallpapers: [
            { id: 'default', thumbnail: 'default-thumb.jpg' },
            { id: 'dark', thumbnail: 'dark-thumb.jpg' },
            { id: 'light', thumbnail: 'light-thumb.jpg' }
        ]
    }
};

describe('Wallpaper Tests', () => {
    beforeEach(() => {
        sendLogToPopup('🧪 Starting wallpaper test', 'info');
        
        // Mock DOM elements
        document.body.innerHTML = `
            <div id="wallpapers-grid"></div>
        `;

        // Mock fetch dla manifestu tapet
        global.fetch = jest.fn((url) => {
            if (url.includes('manifest.json')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockWallpapers.manifest)
                });
            }
            return Promise.reject(new Error('Unknown endpoint'));
        });

        // Mock localStorage
        const localStorageMock = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            clear: jest.fn()
        };
        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock
        });
    });

    test('should initialize with default wallpaper', async () => {
        try {
            await WallpaperManager.init();
            expect(document.body.style.backgroundImage).toBe('');
            sendLogToPopup('✅ Wallpaper initialization test passed', 'success');
        } catch (error) {
            sendLogToPopup('❌ Wallpaper initialization test failed', 'error', error.message);
            throw error;
        }
    });

    test('should apply custom wallpaper', async () => {
        try {
            await WallpaperManager.applyWallpaper('dark');
            expect(document.body.style.backgroundImage).toBe('url(wallpapers/dark.jpg)');
            sendLogToPopup('✅ Custom wallpaper test passed', 'success');
        } catch (error) {
            sendLogToPopup('❌ Custom wallpaper test failed', 'error', error.message);
            throw error;
        }
    });
}); 