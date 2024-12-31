import { logService } from './LogService.js';
import { notificationService } from './NotificationService.js';
import { RequestQueueService } from './RequestQueueService.js';

export class StatusCheckerService {
    constructor() {
        this.checkInterval = 5 * 60 * 1000; // 5 minutes
        this.retryAttempts = 3;
        this.retryDelay = 10 * 1000; // 10 seconds
        this.endpoints = new Map();
        this.intervalId = null;
        this.isRunning = false;
        logService.info('StatusCheckerService constructed');
    }

    initialize() {
        if (this.isRunning) return;
        
        logService.info('Initializing StatusCheckerService...');
        this.startChecking();
        logService.info('StatusCheckerService initialized successfully');
    }

    addEndpoint(name, url, options = {}) {
        this.endpoints.set(name, {
            url,
            ...options,
            status: 'unknown'
        });
        logService.debug('Endpoint added', { name, url });
    }

    removeEndpoint(name) {
        this.endpoints.delete(name);
        logService.debug('Endpoint removed', { name });
    }

    async checkEndpoint(name) {
        const endpoint = this.endpoints.get(name);
        if (!endpoint) return;

        let attempts = 0;
        while (attempts < this.retryAttempts) {
            try {
                logService.debug('Checking endpoint...', { name, attempt: attempts + 1 });
                const response = await RequestQueueService.enqueue(() => 
                    fetch(endpoint.url, endpoint.options)
                );

                const newStatus = response.ok ? 'healthy' : 'unhealthy';
                if (newStatus !== endpoint.status) {
                    this.handleStatusChange(name, newStatus);
                }
                endpoint.status = newStatus;
                endpoint.lastCheck = Date.now();
                logService.debug('Endpoint check completed', { name, status: newStatus });
                return;
            } catch (error) {
                attempts++;
                if (attempts === this.retryAttempts) {
                    this.handleStatusChange(name, 'error');
                    endpoint.status = 'error';
                    logService.error('Endpoint check failed', { name, error });
                } else {
                    logService.warn('Endpoint check attempt failed, retrying...', { name, attempt: attempts });
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
    }

    async checkAll() {
        logService.debug('Starting check for all endpoints...');
        const checks = Array.from(this.endpoints.keys()).map(name => 
            this.checkEndpoint(name)
        );
        await Promise.all(checks);
        logService.debug('All endpoint checks completed');
    }

    handleStatusChange(name, status) {
        const title = `Service Status: ${name}`;
        const message = `Service is now ${status}`;
        const type = status === 'healthy' ? 'success' : 'error';

        notificationService.show({
            title,
            message,
            type
        });

        logService.info('Service status changed', { name, status });
    }

    startChecking() {
        this.isRunning = true;
        this.checkAll();
        this.intervalId = setInterval(() => this.checkAll(), this.checkInterval);
        logService.info('Status checking started');
    }

    stopChecking() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        logService.info('Status checking stopped');
    }

    getStatus(name) {
        return this.endpoints.get(name)?.status || 'unknown';
    }

    getAllStatuses() {
        const statuses = {};
        this.endpoints.forEach((endpoint, name) => {
            statuses[name] = endpoint.status;
        });
        return statuses;
    }
}

export const statusCheckerService = new StatusCheckerService(); 