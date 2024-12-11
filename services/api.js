export const API = {
    checkStatus: async () => {
        try {
            const response = await fetch('https://api.darwina.pl/status');
            if (!response.ok) throw new Error('Status check failed');
            return await response.json();
        } catch (error) {
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