export class StatusChecker {
    constructor(darwinApi) {
        this.darwinApi = darwinApi;
        this.tests = [
            {
                name: 'API',
                test: () => this.testApiConnection()
            },
            {
                name: 'AUTH',
                test: () => this.testAuthentication()
            },
            {
                name: 'ORDERS',
                test: () => this.testOrders()
            },
            {
                name: 'CACHE',
                test: () => this.testCache()
            }
        ];
    }

    async runTests() {
        const results = {};
        
        for (const test of this.tests) {
            results[test.name] = 'testing';
            this.updateStatus(results);
            
            try {
                const result = await test.test();
                results[test.name] = result ? 'green' : 'red';
            } catch (error) {
                console.error(`Test ${test.name} failed:`, error);
                results[test.name] = 'red';
            }
            
            this.updateStatus(results);
            // Krótka pauza między testami dla lepszego efektu wizualnego
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return results;
    }

    async testApiConnection() {
        try {
            const response = await fetch(`${this.darwinApi.baseUrl}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }

    async testAuthentication() {
        try {
            const headers = this.darwinApi.getHeaders();
            return !!headers.Authorization;
        } catch {
            return false;
        }
    }

    async testOrders() {
        try {
            const counts = await this.darwinApi.fetchLeadCounts();
            return counts !== null;
        } catch {
            return false;
        }
    }

    testCache() {
        try {
            localStorage.setItem('test-cache', 'test');
            const result = localStorage.getItem('test-cache') === 'test';
            localStorage.removeItem('test-cache');
            return result;
        } catch {
            return false;
        }
    }

    updateStatus(results) {
        Object.entries(results).forEach(([service, status]) => {
            const element = document.getElementById(`${service.toLowerCase()}-status`);
            if (element) {
                element.className = `status-dot ${status === 'testing' ? 'testing' : `status-${status}`}`;
            }
        });
    }
} 