import puppeteer from 'puppeteer';

/**
 * Konfiguracja dla Puppeteer
 */
const BROWSER_CONFIG = {
    headless: 'new',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=800,600'
    ]
};

/**
 * Uruchamia przeglądarkę dla testów E2E
 * @returns {Promise<Browser>}
 */
export async function launchBrowser() {
    const browser = await puppeteer.launch(BROWSER_CONFIG);
    
    // Dodaj pomocnicze funkcje do kontekstu przeglądarki
    browser.evaluateOnNewDocument = async (fn) => {
        const pages = await browser.pages();
        await Promise.all(pages.map(page => page.evaluateOnNewDocument(fn)));
    };

    // Dodaj wsparcie dla monitorowania wydajności
    await browser.evaluateOnNewDocument(() => {
        window.performanceMetrics = {
            frames: [],
            events: [],
            marks: new Map()
        };

        // Monitoruj FPS
        const frameMonitor = () => {
            const time = performance.now();
            window.performanceMetrics.frames.push(time);
            requestAnimationFrame(frameMonitor);
        };
        requestAnimationFrame(frameMonitor);

        // Monitoruj zdarzenia wydajnościowe
        const observer = new PerformanceObserver((list) => {
            window.performanceMetrics.events.push(...list.getEntries());
        });
        observer.observe({ 
            entryTypes: ['paint', 'layout', 'measure', 'longtask'] 
        });
    });

    return browser;
}

/**
 * Zamyka przeglądarkę
 * @param {Browser} browser 
 */
export async function closeBrowser(browser) {
    if (browser) {
        await browser.close();
    }
}

/**
 * Czeka na stabilizację animacji
 * @param {Page} page 
 * @param {number} timeout 
 */
export async function waitForAnimationComplete(page, timeout = 1000) {
    await page.waitForFunction(
        (timeout) => new Promise(resolve => {
            let lastFrame = performance.now();
            let stableFrames = 0;
            
            const checkStability = () => {
                const now = performance.now();
                const delta = now - lastFrame;
                
                if (delta > 16.7) { // ~60fps
                    stableFrames = 0;
                } else {
                    stableFrames++;
                }
                
                lastFrame = now;
                
                if (stableFrames >= 10) { // 10 stabilnych klatek
                    resolve(true);
                } else {
                    requestAnimationFrame(checkStability);
                }
            };
            
            requestAnimationFrame(checkStability);
            setTimeout(() => resolve(false), timeout);
        }),
        {},
        timeout
    );
}

/**
 * Pobiera metryki wydajności
 * @param {Page} page 
 */
export async function getPerformanceMetrics(page) {
    return page.evaluate(() => {
        const { frames, events } = window.performanceMetrics;
        
        // Oblicz FPS
        const intervals = frames.slice(1).map((t, i) => t - frames[i]);
        const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
        const fps = 1000 / avgInterval;

        // Znajdź długie zadania
        const longTasks = events.filter(e => e.entryType === 'longtask');
        
        return {
            fps,
            frameCount: frames.length,
            longTasks: longTasks.length,
            totalBlockingTime: longTasks.reduce((sum, task) => sum + task.duration, 0),
            firstPaint: events.find(e => e.name === 'first-paint')?.startTime,
            firstContentfulPaint: events.find(e => e.name === 'first-contentful-paint')?.startTime
        };
    });
} 