/**
 * Serwis do zarządzania limitami requestów API
 */
import { REQUEST_LIMITS } from '../config/request.limits.js';

export class RequestLimiter {
    constructor() {
        this.requestQueue = [];
        this.activeRequests = 0;
        this.maxConcurrentRequests = REQUEST_LIMITS.queue.maxConcurrent;
        
        // Limity czasowe
        this.limits = REQUEST_LIMITS.rateLimit;
        
        // Liczniki requestów
        this.counters = {
            second: { count: 0, resetAt: Date.now() + 1000 },
            minute: { count: 0, resetAt: Date.now() + 60000 },
            hour: { count: 0, resetAt: Date.now() + 3600000 }
        };

        // Cache dla requestów
        this.cache = new Map();
        this.cacheTimeout = REQUEST_LIMITS.cache.timeout;

        // Uruchom czyszczenie cache'a
        if (REQUEST_LIMITS.cache.enabled) {
            setInterval(() => this.cleanupCache(), 
                REQUEST_LIMITS.cache.cleanupInterval
            );
        }
    }

    /**
     * Wykonuje request z uwzględnieniem limitów
     * @param {Object} config - Konfiguracja requestu
     * @returns {Promise} 
     */
    async executeRequest(config) {
        const { 
            url, 
            priority = REQUEST_LIMITS.priority.MEDIUM, 
            cacheKey, 
            options = {},
            timeout = REQUEST_LIMITS.queue.timeout
        } = config;

        // Sprawdź cache
        if (REQUEST_LIMITS.cache.enabled && cacheKey) {
            const cachedResponse = this.getFromCache(cacheKey);
            if (cachedResponse) return cachedResponse;
        }

        // Sprawdź limity
        if (this.isLimitExceeded()) {
            const error = new Error('API rate limit exceeded');
            error.code = 'RATE_LIMIT_EXCEEDED';
            throw error;
        }

        // Dodaj do kolejki
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Request timeout'));
            }, timeout);
        });

        const requestPromise = new Promise((resolve, reject) => {
            this.requestQueue.push({
                url,
                options,
                priority,
                cacheKey,
                resolve,
                reject,
                addedAt: Date.now()
            });

            // Sortuj kolejkę według priorytetu
            this.requestQueue.sort((a, b) => b.priority - a.priority);
            
            // Rozpocznij przetwarzanie kolejki
            this.processQueue();
        });

        return Promise.race([requestPromise, timeoutPromise]);
    }

    /**
     * Przetwarza kolejkę requestów
     */
    async processQueue() {
        if (this.activeRequests >= this.maxConcurrentRequests || this.requestQueue.length === 0) {
            return;
        }

        const request = this.requestQueue.shift();
        this.activeRequests++;

        try {
            const response = await fetch(request.url, request.options);
            const data = await response.json();

            // Aktualizuj liczniki
            this.updateCounters();

            // Zapisz do cache'a
            if (request.cacheKey) {
                this.addToCache(request.cacheKey, data);
            }

            request.resolve(data);
        } catch (error) {
            request.reject(error);
        } finally {
            this.activeRequests--;
            this.processQueue();
        }
    }

    /**
     * Sprawdza czy przekroczono limity
     */
    isLimitExceeded() {
        const now = Date.now();

        // Resetuj liczniki jeśli minął czas
        for (const [period, data] of Object.entries(this.counters)) {
            if (now >= data.resetAt) {
                data.count = 0;
                data.resetAt = now + (period === 'second' ? 1000 : period === 'minute' ? 60000 : 3600000);
            }
        }

        return this.counters.second.count >= this.limits.perSecond ||
               this.counters.minute.count >= this.limits.perMinute ||
               this.counters.hour.count >= this.limits.perHour;
    }

    /**
     * Aktualizuje liczniki requestów
     */
    updateCounters() {
        this.counters.second.count++;
        this.counters.minute.count++;
        this.counters.hour.count++;
    }

    /**
     * Pobiera dane z cache'a
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }

    /**
     * Dodaje dane do cache'a
     */
    addToCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Czyści cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Zwraca statystyki requestów
     */
    getStats() {
        return {
            queueLength: this.requestQueue.length,
            activeRequests: this.activeRequests,
            counters: {
                second: this.counters.second.count,
                minute: this.counters.minute.count,
                hour: this.counters.hour.count
            },
            cacheSize: this.cache.size
        };
    }

    /**
     * Czyści stare wpisy z cache'a
     */
    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.cache) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Dodaje request do kolejki z obsługą ponawiania
     */
    async addToQueueWithRetry(request, retryCount = 0) {
        try {
            return await request();
        } catch (error) {
            if (retryCount < REQUEST_LIMITS.queue.retryAttempts) {
                await new Promise(resolve => 
                    setTimeout(resolve, REQUEST_LIMITS.queue.retryDelay)
                );
                return this.addToQueueWithRetry(request, retryCount + 1);
            }
            throw error;
        }
    }
}

// Singleton instance
export const requestLimiter = new RequestLimiter(); 