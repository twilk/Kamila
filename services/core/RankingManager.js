import Chart from '../../lib/chart.js';
import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';

export class RankingManager extends BaseManager {
    static _instance = null;

    static getInstance(eventManager) {
        if (!RankingManager._instance) {
            RankingManager._instance = new RankingManager(eventManager);
        }
        return RankingManager._instance;
    }

    constructor(eventManager) {
        if (RankingManager._instance) {
            throw new Error('RankingManager is a singleton. Use RankingManager.getInstance() instead.');
        }
        super('RankingManager');
        this.eventManager = eventManager;
        this.sortConfig = {
            field: 'rank',
            direction: 'asc'
        };
        this.filters = {
            name: '',
            position: '',
            trend: ''
        };
        this.data = [];
        RankingManager._instance = this;
    }

    // ... existing code ...
}

// Export singleton instance
export const rankingManager = RankingManager.getInstance(); 