import { logService } from './services/LogService.js';
import { darwinaService } from './services/DarwinaService.js';
import { userCardService } from './services/UserCardService.js';
import { loadingService } from './services/LoadingService.js';
import { notificationService } from './services/NotificationService.js';
import { statusCheckerService } from './services/StatusCheckerService.js';
import { updateManagerService } from './services/UpdateManagerService.js';

// Initialize background services
async function initializeBackgroundServices() {
    try {
        logService.info('Initializing background services...');

        // Initialize core services
        await loadingService.initialize();
        logService.info('LoadingService initialized');

        // Initialize API services
        await darwinaService.initialize();
        logService.info('DarwinaService initialized');

        // Initialize business logic services
        await userCardService.initialize();
        logService.info('UserCardService initialized');

        // Initialize management services
        await Promise.all([
            notificationService.initialize(),
            statusCheckerService.initialize(),
            updateManagerService.initialize()
        ]);
        logService.info('Management services initialized');

        logService.info('Background services initialized successfully');
    } catch (error) {
        logService.error('Failed to initialize background services:', error);
        notificationService.showError('Failed to initialize background services');
    }
}

// Initialize services
initializeBackgroundServices(); 