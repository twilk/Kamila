import { i18n } from '../../services/i18n.js';
import { 
    checkApiStatus, 
    checkAuthStatus, 
    checkOrdersStatus, 
    checkCacheStatus 
} from '../../services/api.js';

export class StatusManager {
    constructor() {
        this.tooltipList = [];
    }

    async updateAllStatuses(fullTest = false) {
        try {
            // Pokaż loader dla wszystkich statusów
            ['api', 'auth', 'orders', 'cache'].forEach(service => {
                const dot = document.getElementById(`${service}-status`);
                if (dot) {
                    dot.className = 'status-dot';
                    dot.style.opacity = '0.5';
                }
            });

            const statuses = {
                'api-status': await checkApiStatus(),
                'auth-status': await checkAuthStatus(),
                'orders-status': await checkOrdersStatus(),
                'cache-status': await checkCacheStatus()
            };

            // Aktualizuj kropki statusu
            Object.entries(statuses).forEach(([id, status]) => {
                const dot = document.getElementById(id);
                if (dot) {
                    dot.className = `status-dot status-${status ? 'green' : 'red'}`;
                    dot.style.opacity = '1';
                }
            });

            if (fullTest) {
                logToPanel(i18n.translate('testsCompleted'), 'success');
            }
        } catch (error) {
            logToPanel(i18n.translate('errorStatusCheck'), 'error', error);
        }
    }

    async updateLeadCounts(newCounts, oldCounts = {}) {
        try {
            const { leadCounts: currentCounts } = await chrome.storage.local.get('leadCounts');
            if (JSON.stringify(newCounts) !== JSON.stringify(currentCounts)) {
                await chrome.storage.local.set({ leadCounts: newCounts });
                
                for (const [status, count] of Object.entries(newCounts)) {
                    const countElement = document.getElementById(`count-${status}`);
                    if (!countElement) continue;

                    const previousCount = oldCounts[status] || 0;
                    
                    countElement.textContent = count;
                    countElement.classList.toggle('count-zero', count === 0);
                    countElement.classList.add('count-updated');
                    setTimeout(() => countElement.classList.remove('count-updated'), 1000);

                    if ((status === '1' || status === '2') && count > previousCount) {
                        chrome.notifications.create(`status-update-${status}`, {
                            type: 'basic',
                            iconUrl: 'icon128.png',
                            title: i18n.translate('statusUpdate'),
                            message: i18n.translate('statusChangeFormat', {
                                status: status,
                                previous: previousCount,
                                current: count
                            }),
                            priority: 1
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error updating lead counts:', error);
            logToPanel(i18n.translate('errorCounterUpdate'), 'error', error);
        }
    }

    async loadLeadCounts() {
        try {
            const { leadCounts } = await chrome.storage.local.get('leadCounts');
            if (leadCounts) {
                for (const [status, count] of Object.entries(leadCounts)) {
                    const countElement = document.getElementById(`count-${status}`);
                    if (countElement) {
                        countElement.textContent = count;
                        countElement.classList.toggle('count-zero', count === 0);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading lead counts:', error);
            logToPanel('❌ Błąd ładowania liczników', 'error', error);
        }
    }
} 