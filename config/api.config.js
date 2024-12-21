/**
 * API Configuration for KAMILA
 */
export const API_CONFIG = {
    N8N: {
        BASE_URL: process.env.N8N_API_URL || 'https://n8n.darwina.pl',
        ENDPOINTS: {
            WORKFLOW: '/webhook/kamila',
            STATUS: '/webhook/status',
            SYNC: '/webhook/sync'
        },
        TIMEOUT: 5000,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000
    },
    HEADERS: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.N8N_API_KEY
    }
}; 