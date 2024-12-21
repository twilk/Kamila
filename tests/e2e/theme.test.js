import { launchBrowser, closeBrowser } from '../test-utils/browser.js';
import { PerformanceMonitor } from '../../services/performance.js';

describe('Theme System E2E', () => {
    let browser;
    let page;
    
    beforeAll(async () => {
        browser = await launchBrowser();
    });
    
    afterAll(async () => {
        await closeBrowser(browser);
    });
    
    beforeEach(async () => {
        page = await browser.newPage();
        await page.goto('chrome-extension://mock-id/popup.html');
        
        // Czekaj na załadowanie komponentów
        await page.waitForSelector('#theme-panel');
    });
    
    afterEach(async () => {
        await page.close();
    });
    
    describe('Theme Switching', () => {
        test('should switch theme and persist changes', async () => {
            // Zmień motyw na ciemny
            await page.click('#dark-theme');
            
            // Sprawdź czy klasa została dodana
            const hasClass = await page.evaluate(() => 
                document.body.classList.contains('dark-theme')
            );
            expect(hasClass).toBe(true);
            
            // Sprawdź localStorage
            const theme = await page.evaluate(() => 
                localStorage.getItem('theme')
            );
            expect(theme).toBe('dark');
            
            // Odśwież stronę
            await page.reload();
            await page.waitForSelector('#theme-panel');
            
            // Sprawdź czy motyw został zachowany
            const hasClassAfterReload = await page.evaluate(() => 
                document.body.classList.contains('dark-theme')
            );
            expect(hasClassAfterReload).toBe(true);
        });
    });
    
    describe('Theme Panel', () => {
        test('should open panel and customize colors', async () => {
            // Otwórz panel
            await page.click('#edit-theme');
            
            // Sprawdź czy panel jest widoczny
            const isPanelVisible = await page.evaluate(() => 
                document.querySelector('#theme-panel').classList.contains('show')
            );
            expect(isPanelVisible).toBe(true);
            
            // Zmień kolory
            await page.evaluate(() => {
                document.getElementById('primary-color').value = '#000000';
                document.getElementById('secondary-color').value = '#ffffff';
            });
            
            // Zapisz zmiany
            await page.click('#save-theme');
            
            // Sprawdź czy kolory zostały zapisane
            const colors = await page.evaluate(() => 
                JSON.parse(localStorage.getItem('customColors'))
            );
            expect(colors).toEqual({
                primary: '#000000',
                secondary: '#ffffff'
            });
        });
    });
    
    describe('Performance', () => {
        test('should maintain smooth animations', async () => {
            const metrics = await page.evaluate(async () => {
                const monitor = new PerformanceMonitor();
                monitor.startMonitoring();
                
                // Otwórz panel
                document.getElementById('edit-theme').click();
                
                // Poczekaj na animację
                await new Promise(resolve => setTimeout(resolve, 300));
                
                return monitor.stopMonitoring();
            });
            
            expect(metrics.fps).toBeGreaterThanOrEqual(58);
            expect(metrics.jankCount).toBeLessThan(2);
        });
        
        test('should optimize theme changes', async () => {
            const timing = await page.evaluate(async () => {
                performance.mark('theme-start');
                
                // Zmień motyw
                document.getElementById('dark-theme').click();
                
                // Poczekaj na zmiany
                await new Promise(resolve => setTimeout(resolve, 100));
                
                performance.mark('theme-end');
                performance.measure('theme-change', 'theme-start', 'theme-end');
                
                return performance.getEntriesByName('theme-change')[0].duration;
            });
            
            expect(timing).toBeLessThan(50); // max 50ms
        });
    });
    
    describe('Accessibility', () => {
        test('should handle keyboard navigation', async () => {
            // Otwórz panel
            await page.click('#edit-theme');
            
            // Sprawdź focus trap
            await page.keyboard.press('Tab');
            
            const activeElement = await page.evaluate(() => 
                document.activeElement.id
            );
            expect(activeElement).toBe('primary-color');
            
            // Zamknij panel przez Escape
            await page.keyboard.press('Escape');
            
            const isPanelVisible = await page.evaluate(() => 
                document.querySelector('#theme-panel').classList.contains('show')
            );
            expect(isPanelVisible).toBe(false);
        });
    });
}); 