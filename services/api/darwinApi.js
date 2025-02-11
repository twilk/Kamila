class DarwinApi {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    async getLeadDetails(params = {}) {
        try {
            const requestParams = {
                ...params,
                status_id: '1,2,3,5', // All statuses in one request
                limit: params.limit || API_DEFAULTS.LIMIT
            };

            const url = new URL(`${this.baseUrl}${API_ENDPOINTS.ORDERS}`);
            Object.entries(requestParams).forEach(([key, value]) => {
                url.searchParams.append(key, value.toString());
            });

            console.log('[DEBUG] 🔍 Fetching lead details:', {
                params: requestParams,
                url: url.toString()
            });

            const response = await this.makeRequest(url.toString());
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            if (!data.data || !Array.isArray(data.data)) {
                throw new Error('Invalid API response format');
            }

            return {
                success: true,
                data: data.data,
                metadata: data.metadata
            };
        } catch (error) {
            console.error('[ERROR] ❌ Failed to fetch lead details:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export { DarwinApi }; 
