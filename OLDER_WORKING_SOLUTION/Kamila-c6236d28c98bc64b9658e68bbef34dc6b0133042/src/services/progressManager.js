export class ProgressManager {
    constructor() {
        this.container = document.querySelector('.progress-container');
        this.progressBar = document.getElementById('progress-bar');
        this.statusText = document.getElementById('progress-status');
        this.percentageText = document.getElementById('progress-percentage');
        this.currentTask = null;
        this.isVisible = false;
    }

    show(status = 'Ładowanie...') {
        this.container.classList.remove('hidden');
        this.setStatus(status);
        this.setProgress(0);
        this.isVisible = true;
    }

    hide() {
        this.container.classList.add('hidden');
        this.isVisible = false;
        this.currentTask = null;
    }

    setStatus(status) {
        this.statusText.textContent = status;
    }

    setProgress(percentage, status = null) {
        const progress = Math.min(Math.max(percentage, 0), 100);
        this.progressBar.style.width = `${progress}%`;
        this.progressBar.setAttribute('aria-valuenow', progress);
        this.percentageText.textContent = `${Math.round(progress)}%`;
        
        if (status) {
            this.setStatus(status);
        }

        if (progress === 100) {
            setTimeout(() => {
                if (this.isVisible) {
                    this.hide();
                }
            }, 1000);
        }
    }

    startTask(taskName, totalSteps) {
        this.currentTask = {
            name: taskName,
            total: totalSteps,
            current: 0
        };
        this.show(taskName);
    }

    updateTask(increment = 1, status = null) {
        if (!this.currentTask) return;

        this.currentTask.current += increment;
        const progress = (this.currentTask.current / this.currentTask.total) * 100;
        
        this.setProgress(
            progress,
            status || `${this.currentTask.name} (${this.currentTask.current}/${this.currentTask.total})`
        );
    }

    setError(message) {
        this.container.classList.add('error');
        this.setStatus(`Błąd: ${message}`);
        setTimeout(() => {
            this.hide();
            this.container.classList.remove('error');
        }, 3000);
    }

    setSuccess(message) {
        this.container.classList.add('success');
        this.setStatus(message);
        this.setProgress(100);
        setTimeout(() => {
            this.hide();
            this.container.classList.remove('success');
        }, 2000);
    }

    setWarning(message) {
        this.container.classList.add('warning');
        this.setStatus(message);
        setTimeout(() => {
            this.hide();
            this.container.classList.remove('warning');
        }, 3000);
    }
}

export class LeadCountManager {
    constructor() {
        this.version = 1;
        this.updateLock = false;
        this.updateQueue = [];
        this.lastUpdate = 0;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.apiEndpoint = 'https://api.darwina.pl/v1/leads/counts';
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 second
    }

    async validateData(data) {
        if (!data || typeof data !== 'object') return false;
        if (!Array.isArray(data.leads)) return false;
        if (typeof data.timestamp !== 'number') return false;
        
        // Additional validation for lead data structure
        return data.leads.every(lead => (
            typeof lead.status === 'string' &&
            typeof lead.count === 'number' &&
            lead.count >= 0
        ));
    }

    async acquireLock(timeout = 5000) {
        if (this.updateLock) {
            const startTime = Date.now();
            while (this.updateLock && Date.now() - startTime < timeout) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (this.updateLock) {
                return false;
            }
        }
        this.updateLock = true;
        return true;
    }

    releaseLock() {
        this.updateLock = false;
        this.processQueue();
    }

    async queueUpdate(updateFn) {
        return new Promise((resolve, reject) => {
            this.updateQueue.push({ fn: updateFn, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.updateLock || this.updateQueue.length === 0) return;

        const { fn, resolve, reject } = this.updateQueue.shift();
        
        if (await this.acquireLock()) {
            try {
                const result = await fn();
                resolve(result);
            } catch (error) {
                reject(error);
            } finally {
                this.releaseLock();
            }
        } else {
            this.updateQueue.unshift({ fn, resolve, reject });
        }
    }

    async retryOperation(operation, attempts = this.retryAttempts) {
        let lastError;
        for (let i = 0; i < attempts; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (i < attempts - 1) {
                    await new Promise(resolve => 
                        setTimeout(resolve, this.retryDelay * Math.pow(2, i))
                    );
                }
            }
        }
        throw lastError;
    }

    async updateLeadCounts(data) {
        return this.queueUpdate(async () => {
            if (!await this.validateData(data)) {
                throw new Error('Invalid lead count data format');
            }

            const now = Date.now();
            const updateData = {
                version: this.version,
                timestamp: now,
                data: data.leads,
                lastUpdate: now,
                source: 'manual_update'
            };

            await this.retryOperation(async () => {
                await chrome.storage.local.set({ leadCounts: updateData });
            });

            this.lastUpdate = now;
            return updateData;
        });
    }

    async getLeadCounts() {
        try {
            const { leadCounts } = await chrome.storage.local.get('leadCounts');
            
            if (!leadCounts || 
                !leadCounts.version || 
                leadCounts.version !== this.version || 
                Date.now() - leadCounts.timestamp > this.cacheTimeout) {
                return null;
            }

            return leadCounts.data;
        } catch (error) {
            console.error('Error reading lead counts from storage:', error);
            return null;
        }
    }

    async refreshLeadCounts() {
        return this.queueUpdate(async () => {
            return this.retryOperation(async () => {
                const response = await fetch(this.apiEndpoint, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'X-Client-Version': this.version.toString()
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                return this.updateLeadCounts({
                    ...data,
                    timestamp: Date.now(),
                    source: 'api_refresh'
                });
            });
        });
    }

    async clearCache() {
        return this.queueUpdate(async () => {
            await chrome.storage.local.remove('leadCounts');
            this.lastUpdate = 0;
        });
    }
}

// Export both managers
export const progressManager = new ProgressManager();
export const leadCountManager = new LeadCountManager(); 