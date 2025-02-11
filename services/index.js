// Base classes
export { BaseManager } from './core/BaseManager.js';
export { InitLogger } from './core/InitLogger.js';
export { MenuManager } from './core/MenuManager.js';

// Types
export { EventType, ErrorType, ErrorSeverity, LogLevel } from './core/EventType.js';

// Core managers and instances
export {
    managers,
    errorHandler,
    eventManager,
    initializationManager,
    loadingManager,
    connectionManager,
    cacheManager,
    uiManager,
    themeManager,
    menuManager,
    debugManager,
    volumeManager,
    updateManager,
    refreshManager,
    dataManager,
    storeManager,
    statusManager,
    userManager,
    languageManager,
    settingsManager,
    messageManager,
    operationProgressManager,
    counterManager
} from './core/managers.js';

// API services
export { APIManager, apiManager } from './api/index.js';
export { OrderService } from './api/OrderService.js';

// User services
import { UserCardService } from './userCard.js';
export const userCardService = UserCardService.getInstance();
export { UserCardService };

// Utilities
export { i18n } from './i18n.js';
export { stores } from './stores.js';