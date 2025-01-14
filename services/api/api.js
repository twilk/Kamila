import { ErrorType, ErrorSeverity } from '../core/ErrorTypes.js';

export class API {
    constructor() {
        this.baseUrl = '';
        this.headers = new Headers({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        });
    }

    setBaseUrl(url) {
        this.baseUrl = url;
    }

    setHeader(key, value) {
        this.headers.set(key, value);
    }

    async get(endpoint, params = {}) {
        return this.request('GET', endpoint, params);
    }

    async post(endpoint, data = {}) {
        return this.request('POST', endpoint, data);
    }

    async put(endpoint, data = {}) {
        return this.request('PUT', endpoint, data);
    }

    async delete(endpoint) {
        return this.request('DELETE', endpoint);
    }

    async request(method, endpoint, data = null) {
        try {
            const url = new URL(endpoint, this.baseUrl);
            
            if (method === 'GET' && data) {
                Object.entries(data).forEach(([key, value]) => {
                    url.searchParams.append(key, value);
                });
            }

            const options = {
                method,
                headers: this.headers,
                credentials: 'include'
            };

            if (data && method !== 'GET') {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url.toString(), options);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            throw new Error(`API Error: ${error.message}`);
        }
    }
} 