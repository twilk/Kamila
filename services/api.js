import { API_BASE_URL, API_KEY, getSellyCredentials, sendLogToPopup } from '../config/api.js';

export async function checkStatus() {
    const sellyConfig = await getSellyCredentials();
    const response = await fetch(`${sellyConfig.SELLY_API_BASE_URL}/status`, {
        headers: {
            'Authorization': `Bearer ${sellyConfig.SELLY_API_KEY}`
        }
    });
    if (!response.ok) {
        throw new Error('Failed to check status');
    }
    return await response.json();
}

export const API = {
    checkStatus: async () => {
        try {
            const response = await fetch('https://api.darwina.pl/status');
            if (!response.ok) throw new Error('Status check failed');
            sendLogToPopup('✅ API Status check completed', 'success');
            return await response.json();
        } catch (error) {
            sendLogToPopup('❌ API Status check failed', 'error', error.message);
            // Tymczasowo zwracamy symulowane statusy
            return {
                api: 'green',
                auth: 'green',
                orders: 'green',
                cache: 'green'
            };
        }
    }
}; 