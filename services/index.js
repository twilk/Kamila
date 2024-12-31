/**
 * Service exports for DARWINA.PL Assistant
 * Exports are organized by service category and initialization order
 */

// Core infrastructure services (Level 1)
export { logService } from './LogService.js';
export { cacheService } from './CacheService.js';
export { databaseService } from './DatabaseService.js';

// Communication services (Level 2)
export { requestQueueService } from './RequestQueueService.js';
export { apiService } from './ApiService.js';

// UI and localization services (Level 3)
export { i18nService } from './I18nService.js';
export { loadingService } from './LoadingService.js';
export { themeService } from './ThemeService.js';
export { uiComponentService } from './UIComponentService.js';

// Business logic services (Level 4)
export { userCardService } from './UserCardService.js';
export { darwinaService } from './DarwinaService.js';

// Management services (Level 5)
export { statusCheckerService } from './StatusCheckerService.js';
export { updateManagerService } from './UpdateManagerService.js';
export { performanceMonitorService } from './PerformanceMonitorService.js';

// Support services
export { notificationService } from './NotificationService.js';
export { syncService } from './SyncService.js';
export { retryService } from './RetryService.js';

// UI enhancement services
export { wallpaperService } from './WallpaperService.js';
export { wallpaperManagerService } from './WallpaperManagerService.js';

// Error types
export { 
    ApiError, 
    ValidationError, 
    NetworkError, 
    AuthenticationError, 
    CacheError, 
    DatabaseError 
} from './ErrorService.js'; 