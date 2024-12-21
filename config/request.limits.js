/**
 * Konfiguracja limitów requestów API
 */
export const REQUEST_LIMITS = {
    // Limity czasowe
    rateLimit: {
        perSecond: 10,
        perMinute: 300,
        perHour: 10000,
        total: 100000 // Całkowity limit requestów
    },

    // Priorytety requestów
    priority: {
        CRITICAL: 4,  // Krytyczne operacje (np. logowanie)
        HIGH: 3,      // Ważne operacje (np. zapisywanie danych)
        MEDIUM: 2,    // Standardowe operacje
        LOW: 1        // Operacje w tle
    },

    // Konfiguracja kolejki
    queue: {
        maxSize: 1000,
        maxConcurrent: 3,
        timeout: 30000, // 30 sekund na request
        retryAttempts: 3,
        retryDelay: 1000 // 1 sekunda między próbami
    },

    // Konfiguracja cache'a
    cache: {
        enabled: true,
        timeout: 5 * 60 * 1000, // 5 minut
        maxSize: 1000,          // Maksymalna liczba wpisów
        cleanupInterval: 60000  // Czyszczenie co minutę
    }
}; 