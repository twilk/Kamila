import { logService } from '../services/LogService.js';

export const errorUtils = {
    /**
     * Tworzy standardowy obiekt błędu
     */
    createError(message, code = 'UNKNOWN_ERROR', details = {}) {
        const error = new Error(message);
        error.code = code;
        error.details = details;
        return error;
    },

    /**
     * Formatuje błąd do wyświetlenia
     */
    formatError(error) {
        if (!error) {
            return 'Unknown error occurred';
        }

        const message = error.message || error.toString();
        const code = error.code ? ` (${error.code})` : '';
        const details = error.details ? `\nDetails: ${JSON.stringify(error.details)}` : '';

        return `${message}${code}${details}`;
    },

    /**
     * Sprawdza czy błąd jest błędem sieci
     */
    isNetworkError(error) {
        return (
            error.name === 'NetworkError' ||
            error.message.includes('network') ||
            error.message.includes('Network') ||
            error.message.includes('Failed to fetch') ||
            error.code === 'NETWORK_ERROR'
        );
    },

    /**
     * Sprawdza czy błąd jest timeoutem
     */
    isTimeoutError(error) {
        return (
            error.name === 'TimeoutError' ||
            error.message.includes('timeout') ||
            error.message.includes('Timeout') ||
            error.code === 'TIMEOUT_ERROR'
        );
    },

    /**
     * Loguje błąd z odpowiednim poziomem
     */
    logError(error, level = 'error') {
        const formattedError = this.formatError(error);
        
        if (level === 'warn') {
            logService.warn(formattedError, error);
        } else if (level === 'info') {
            logService.info(formattedError, error);
        } else if (level === 'debug') {
            logService.debug(formattedError, error);
        } else {
            logService.error(formattedError, error);
        }
    },

    /**
     * Tworzy błąd API
     */
    createApiError(response, message = 'API request failed') {
        const error = this.createError(
            message,
            'API_ERROR',
            {
                status: response.status,
                statusText: response.statusText,
                url: response.url
            }
        );
        error.response = response;
        return error;
    },

    /**
     * Sprawdza czy błąd jest błędem API
     */
    isApiError(error) {
        return error.code === 'API_ERROR' && error.response;
    }
}; 