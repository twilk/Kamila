import { logService } from './LogService.js';
import { notification } from '../components/Notification.js';

/**
 * Konfiguracja domyślna dla retry policy
 */
const DEFAULT_CONFIG = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    backoffFactor: 2,
    timeout: 10000,
    retryableErrors: [
        'NetworkError',
        'TimeoutError',
        'ConnectionError',
        'ECONNREFUSED',
        'ETIMEDOUT'
    ]
};

export class RetryService {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        logService.info('RetryService constructed');
    }

    /**
     * Wykonuje funkcję z obsługą ponownych prób
     * @param {Function} fn Funkcja do wykonania
     * @param {Object} options Opcje konfiguracyjne
     * @returns {Promise} Wynik wykonania funkcji
     */
    async execute(fn, options = {}) {
        const config = { ...this.config, ...options };
        let attempt = 1;
        let delay = config.initialDelay;

        while (attempt <= config.maxAttempts) {
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Operation timed out')), config.timeout);
                });

                const result = await Promise.race([
                    fn(),
                    timeoutPromise
                ]);

                if (attempt > 1) {
                    notification.success('Connection restored', {
                        message: 'Operation completed successfully after retry'
                    });
                }

                return result;

            } catch (error) {
                logService.warn(`Attempt ${attempt} failed:`, error);

                if (attempt === config.maxAttempts || !this.isRetryableError(error, config)) {
                    notification.error('Connection failed', {
                        message: `Failed after ${attempt} attempts: ${error.message}`
                    });
                    throw error;
                }

                notification.warning('Retrying connection', {
                    message: `Attempt ${attempt} failed. Retrying in ${delay/1000}s...`
                });

                await this.sleep(delay);
                delay = Math.min(delay * config.backoffFactor, config.maxDelay);
                attempt++;
            }
        }
    }

    /**
     * Sprawdza czy błąd kwalifikuje się do ponownej próby
     * @param {Error} error Błąd do sprawdzenia
     * @param {Object} config Konfiguracja
     * @returns {boolean} Czy należy ponowić próbę
     */
    isRetryableError(error, config) {
        return config.retryableErrors.some(type => 
            error.name === type || 
            error.message.includes(type) ||
            (error.code && error.code === type)
        );
    }

    /**
     * Czeka określony czas
     * @param {number} ms Czas w milisekundach
     * @returns {Promise} Promise rozwiązywany po określonym czasie
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const retryService = new RetryService(); 