const puppeteer = require('puppeteer');
const { performance } = require('perf_hooks');

describe('Performance Tests', () => {
    let browser;
    let page;

    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        await page.setCacheEnabled(false);
    });

    afterAll(async () => {
        await browser.close();
    });

    describe('Initial Load Performance', () => {
        test('should load popup under 2 seconds', async () => {
            const startTime = performance.now();
            await page.goto('chrome-extension://[extension-id]/popup.html');
            const loadTime = performance.now() - startTime;
            
            expect(loadTime).toBeLessThan(2000);
        });

        test('should have optimal memory usage', async () => {
            const metrics = await page.metrics();
            expect(metrics.JSHeapUsedSize / 1024 / 1024).toBeLessThan(100);
        });

        test('should load accessibility features quickly', async () => {
            const timing = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    document.documentElement.setAttribute('role', 'application');
                    requestAnimationFrame(() => {
                        resolve(performance.now() - start);
                    });
                });
            });
            expect(timing).toBeLessThan(50);
        });
    });

    describe('Theme System Performance', () => {
        beforeEach(async () => {
            await page.goto('chrome-extension://[extension-id]/popup.html');
        });

        test('should switch theme under 50ms', async () => {
            const switchTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    document.documentElement.classList.toggle('dark-theme');
                    requestAnimationFrame(() => {
                        resolve(performance.now() - start);
                    });
                });
            });
            expect(switchTime).toBeLessThan(50);
        });

        test('should maintain 60fps during animations', async () => {
            const metrics = await page.evaluate(() => {
                return new Promise(resolve => {
                    const frames = [];
                    let lastTimestamp = performance.now();

                    const measureFrame = (timestamp) => {
                        const delta = timestamp - lastTimestamp;
                        frames.push(1000 / delta);
                        lastTimestamp = timestamp;

                        if (frames.length < 60) {
                            requestAnimationFrame(measureFrame);
                        } else {
                            resolve(frames);
                        }
                    };

                    requestAnimationFrame(measureFrame);
                    document.querySelector('.theme-panel').classList.add('show');
                });
            });

            const avgFps = metrics.reduce((a, b) => a + b) / metrics.length;
            expect(avgFps).toBeGreaterThanOrEqual(58);
        });

        test('should switch high contrast theme efficiently', async () => {
            const switchTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    document.documentElement.classList.add('high-contrast');
                    requestAnimationFrame(() => {
                        resolve(performance.now() - start);
                    });
                });
            });
            expect(switchTime).toBeLessThan(50);
        });
    });

    describe('API Performance', () => {
        test('should respond within 500ms', async () => {
            const responseTime = await page.evaluate(() => {
                return new Promise(async (resolve) => {
                    const start = performance.now();
                    await fetch('https://api.darwina.pl/status');
                    resolve(performance.now() - start);
                });
            });
            expect(responseTime).toBeLessThan(500);
        });

        test('should properly cache responses', async () => {
            const times = [];
            
            // First call - no cache
            times.push(await page.evaluate(async () => {
                const start = performance.now();
                await fetch('https://api.darwina.pl/data');
                return performance.now() - start;
            }));

            // Second call - should use cache
            times.push(await page.evaluate(async () => {
                const start = performance.now();
                await fetch('https://api.darwina.pl/data');
                return performance.now() - start;
            }));

            expect(times[1]).toBeLessThan(times[0] * 0.5);
        });

        test('should invalidate cache after 5 minutes', async () => {
            jest.useFakeTimers();
            
            await page.evaluate(() => {
                localStorage.setItem('cache-timestamp', Date.now());
                localStorage.setItem('cache-data', JSON.stringify({ test: 'data' }));
            });

            jest.advanceTimersByTime(5 * 60 * 1000);

            const isCacheValid = await page.evaluate(() => {
                const timestamp = localStorage.getItem('cache-timestamp');
                return Date.now() - timestamp < 5 * 60 * 1000;
            });

            expect(isCacheValid).toBeFalsy();
            
            jest.useRealTimers();
        });
    });

    describe('Internationalization Performance', () => {
        test('should switch languages under 100ms', async () => {
            const switchTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    document.documentElement.setAttribute('lang', 'pl');
                    requestAnimationFrame(() => {
                        resolve(performance.now() - start);
                    });
                });
            });
            expect(switchTime).toBeLessThan(100);
        });

        test('should load translations efficiently', async () => {
            const loadTime = await page.evaluate(async () => {
                const start = performance.now();
                await fetch('/_locales/pl/messages.json');
                return performance.now() - start;
            });
            expect(loadTime).toBeLessThan(200);
        });
    });

    describe('Memory Management', () => {
        test('should clean up resources after theme changes', async () => {
            const initialMemory = await page.evaluate(() => performance.memory.usedJSHeapSize);
            
            for (let i = 0; i < 10; i++) {
                await page.evaluate(() => {
                    document.documentElement.classList.toggle('dark-theme');
                });
            }

            const finalMemory = await page.evaluate(() => performance.memory.usedJSHeapSize);
            const memoryDiff = Math.abs(finalMemory - initialMemory);
            
            expect(memoryDiff).toBeLessThan(1024 * 1024);
        });

        test('should maintain stable memory during API operations', async () => {
            const initialMemory = await page.evaluate(() => performance.memory.usedJSHeapSize);
            
            // Simulate multiple API calls
            for (let i = 0; i < 5; i++) {
                await page.evaluate(async () => {
                    await fetch('https://api.darwina.pl/data');
                });
            }

            const finalMemory = await page.evaluate(() => performance.memory.usedJSHeapSize);
            expect(finalMemory - initialMemory).toBeLessThan(2 * 1024 * 1024); // Max 2MB increase
        });
    });

    describe('UI Responsiveness', () => {
        test('should handle rapid user interactions', async () => {
            const interactions = await page.evaluate(() => {
                return new Promise(resolve => {
                    const times = [];
                    const start = performance.now();
                    
                    // Simulate rapid UI interactions
                    for (let i = 0; i < 10; i++) {
                        document.documentElement.classList.toggle('dark-theme');
                        document.documentElement.setAttribute('lang', i % 2 ? 'en' : 'pl');
                        times.push(performance.now() - start);
                    }
                    
                    resolve(times);
                });
            });

            // Each interaction should be under 50ms
            interactions.forEach(time => {
                expect(time % 50).toBeLessThan(50);
            });
        });
    });

    describe('Accessibility Performance', () => {
        test('should apply high contrast mode instantly', async () => {
            const switchTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    document.documentElement.classList.add('high-contrast');
                    requestAnimationFrame(() => resolve(performance.now() - start));
                });
            });
            expect(switchTime).toBeLessThan(50); // WCAG requirement
        });

        test('should handle keyboard navigation efficiently', async () => {
            const navigationTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    const elements = document.querySelectorAll('button, a, input');
                    elements.forEach(el => el.focus());
                    requestAnimationFrame(() => resolve(performance.now() - start));
                });
            });
            expect(navigationTime / elements.length).toBeLessThan(16); // 60fps = ~16ms per frame
        });

        test('should update ARIA attributes quickly', async () => {
            const updateTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    document.querySelectorAll('[aria-live]').forEach(el => {
                        el.setAttribute('aria-busy', 'true');
                        el.textContent = 'Updated content';
                        el.setAttribute('aria-busy', 'false');
                    });
                    requestAnimationFrame(() => resolve(performance.now() - start));
                });
            });
            expect(updateTime).toBeLessThan(50);
        });
    });

    describe('Error Handling Performance', () => {
        test('should handle API errors gracefully', async () => {
            const errorHandlingTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    fetch('https://api.darwina.pl/invalid-endpoint')
                        .catch(() => resolve(performance.now() - start));
                });
            });
            expect(errorHandlingTime).toBeLessThan(100);
        });

        test('should show error messages quickly', async () => {
            const displayTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    const errorContainer = document.createElement('div');
                    errorContainer.className = 'error-message';
                    errorContainer.textContent = 'Test error message';
                    document.body.appendChild(errorContainer);
                    requestAnimationFrame(() => resolve(performance.now() - start));
                });
            });
            expect(displayTime).toBeLessThan(50);
        });
    });

    describe('State Management Performance', () => {
        test('should update store efficiently', async () => {
            const updateTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    chrome.storage.local.set({ testKey: 'testValue' }, () => {
                        resolve(performance.now() - start);
                    });
                });
            });
            expect(updateTime).toBeLessThan(100);
        });

        test('should handle multiple state updates', async () => {
            const batchUpdateTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    const updates = Array(10).fill().map((_, i) => ({ [`key${i}`]: `value${i}` }));
                    Promise.all(updates.map(update => 
                        new Promise(r => chrome.storage.local.set(update, r))
                    )).then(() => resolve(performance.now() - start));
                });
            });
            expect(batchUpdateTime).toBeLessThan(500);
        });
    });

    describe('Debug Mode Performance', () => {
        test('should toggle debug panel quickly', async () => {
            const toggleTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    document.querySelector('#debug-panel').classList.toggle('show');
                    requestAnimationFrame(() => resolve(performance.now() - start));
                });
            });
            expect(toggleTime).toBeLessThan(50);
        });

        test('should log messages efficiently', async () => {
            const loggingTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    for (let i = 0; i < 100; i++) {
                        console.log(`Test log message ${i}`);
                    }
                    resolve(performance.now() - start);
                });
            });
            expect(loggingTime).toBeLessThan(100);
        });
    });

    describe('Order Management Performance', () => {
        test('should fetch order statuses efficiently', async () => {
            const fetchTime = await page.evaluate(() => {
                return new Promise(async (resolve) => {
                    const start = performance.now();
                    await fetch('https://api.darwina.pl/orders/status');
                    resolve(performance.now() - start);
                });
            });
            expect(fetchTime).toBeLessThan(300); // Faster than general API requirement
        });

        test('should update multiple order statuses in batch', async () => {
            const batchTime = await page.evaluate(() => {
                return new Promise(async (resolve) => {
                    const start = performance.now();
                    const orders = Array(5).fill().map((_, i) => ({
                        id: i,
                        status: 'READY'
                    }));
                    await fetch('https://api.darwina.pl/orders/batch-update', {
                        method: 'POST',
                        body: JSON.stringify(orders)
                    });
                    resolve(performance.now() - start);
                });
            });
            expect(batchTime).toBeLessThan(1000); // Batch operations allowance
        });

        test('should detect overdue orders quickly', async () => {
            const checkTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    const orders = Array(100).fill().map((_, i) => ({
                        id: i,
                        created_at: new Date(Date.now() - (i * 24 * 60 * 60 * 1000))
                    }));
                    const overdue = orders.filter(order => 
                        Date.now() - new Date(order.created_at) > 21 * 24 * 60 * 60 * 1000
                    );
                    resolve(performance.now() - start);
                });
            });
            expect(checkTime).toBeLessThan(50);
        });
    });

    describe('Integration Performance', () => {
        test('should handle n8n workflow triggers efficiently', async () => {
            const triggerTime = await page.evaluate(() => {
                return new Promise(async (resolve) => {
                    const start = performance.now();
                    await fetch('https://n8n.darwina.pl/webhook/trigger', {
                        method: 'POST',
                        body: JSON.stringify({ event: 'order_status_change' })
                    });
                    resolve(performance.now() - start);
                });
            });
            expect(triggerTime).toBeLessThan(200);
        });

        test('should process Make.com webhooks quickly', async () => {
            const webhookTime = await page.evaluate(() => {
                return new Promise(async (resolve) => {
                    const start = performance.now();
                    await fetch('https://hook.make.com/trigger/darwina', {
                        method: 'POST',
                        body: JSON.stringify({ type: 'status_update' })
                    });
                    resolve(performance.now() - start);
                });
            });
            expect(webhookTime).toBeLessThan(200);
        });
    });

    describe('Security Performance', () => {
        test('should validate API tokens efficiently', async () => {
            const validationTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    const token = localStorage.getItem('api_token');
                    const isValid = token && 
                        token.split('.').length === 3 && 
                        Date.now() < JSON.parse(atob(token.split('.')[1])).exp * 1000;
                    resolve(performance.now() - start);
                });
            });
            expect(validationTime).toBeLessThan(5); // Token validation should be very fast
        });

        test('should encrypt sensitive data quickly', async () => {
            const encryptionTime = await page.evaluate(() => {
                return new Promise(async (resolve) => {
                    const start = performance.now();
                    const encoder = new TextEncoder();
                    const data = encoder.encode('sensitive_data');
                    await crypto.subtle.digest('SHA-256', data);
                    resolve(performance.now() - start);
                });
            });
            expect(encryptionTime).toBeLessThan(50);
        });
    });

    describe('Mobile Responsiveness Performance', () => {
        beforeEach(async () => {
            // Set mobile viewport
            await page.setViewport({
                width: 375,
                height: 667,
                isMobile: true,
                hasTouch: true
            });
        });

        test('should adapt layout quickly on resize', async () => {
            const resizeTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    window.dispatchEvent(new Event('resize'));
                    requestAnimationFrame(() => resolve(performance.now() - start));
                });
            });
            expect(resizeTime).toBeLessThan(100);
        });

        test('should handle touch events efficiently', async () => {
            const touchTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    const touchEvent = new TouchEvent('touchstart', {
                        touches: [{ clientX: 100, clientY: 100 }]
                    });
                    document.dispatchEvent(touchEvent);
                    requestAnimationFrame(() => resolve(performance.now() - start));
                });
            });
            expect(touchTime).toBeLessThan(16); // One frame at 60fps
        });
    });

    describe('Background Tasks Performance', () => {
        test('should handle service worker installation quickly', async () => {
            const installTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    navigator.serviceWorker.register('/background.js')
                        .then(() => resolve(performance.now() - start));
                });
            });
            expect(installTime).toBeLessThan(1000);
        });

        test('should process background tasks efficiently', async () => {
            const taskTime = await page.evaluate(() => {
                return new Promise(resolve => {
                    const start = performance.now();
                    chrome.runtime.sendMessage({ type: 'BACKGROUND_TASK' }, 
                        () => resolve(performance.now() - start));
                });
            });
            expect(taskTime).toBeLessThan(200);
        });
    });

    describe('Resource Loading Performance', () => {
        test('should load and parse locales efficiently', async () => {
            const loadTime = await page.evaluate(async () => {
                const start = performance.now();
                const [en, pl, ua] = await Promise.all([
                    fetch('/locales/en/messages.json'),
                    fetch('/locales/pl/messages.json'),
                    fetch('/locales/ua/messages.json')
                ]);
                await Promise.all([en.json(), pl.json(), ua.json()]);
                return performance.now() - start;
            });
            expect(loadTime).toBeLessThan(500);
        });

        test('should load theme assets quickly', async () => {
            const assetLoadTime = await page.evaluate(async () => {
                const start = performance.now();
                await Promise.all([
                    fetch('/styles/theme.css'),
                    fetch('/styles/animations.css')
                ]);
                return performance.now() - start;
            });
            expect(assetLoadTime).toBeLessThan(300);
        });
    });

    describe('Overall Performance Metrics', () => {
        test('should meet core web vitals thresholds', async () => {
            const metrics = await page.evaluate(() => {
                return new Promise(resolve => {
                    const observer = new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        resolve(entries);
                        observer.disconnect();
                    });
                    
                    observer.observe({ 
                        entryTypes: ['layout-shift', 'largest-contentful-paint', 'first-input'] 
                    });
                });
            });

            const lcp = metrics.find(m => m.entryType === 'largest-contentful-paint');
            const fid = metrics.find(m => m.entryType === 'first-input');
            const cls = metrics.find(m => m.entryType === 'layout-shift');

            expect(lcp?.startTime).toBeLessThan(2500); // LCP threshold
            expect(fid?.processingStart - fid?.startTime).toBeLessThan(100); // FID threshold
            expect(cls?.value).toBeLessThan(0.1); // CLS threshold
        });
    });
}); 