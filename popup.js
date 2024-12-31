import { logService } from './services/LogService.js';
import { darwinaService } from './services/DarwinaService.js';
import { userCardService } from './services/UserCardService.js';
import { loadingService } from './services/LoadingService.js';
import { i18nService } from './services/I18nService.js';
import { themeService } from './services/ThemeService.js';
import { uiComponentService } from './services/UIComponentService.js';
import { notificationService } from './services/NotificationService.js';
import { statusCheckerService } from './services/StatusCheckerService.js';
import { updateManagerService } from './services/UpdateManagerService.js';
import { performanceMonitorService } from './services/PerformanceMonitorService.js';

// Initialize services
async function initializeServices() {
    try {
        logService.info('Initializing application...');

        // Initialize core infrastructure
        await Promise.all([
            loadingService.initialize(),
            i18nService.initialize(),
            themeService.initialize()
        ]).catch(error => {
            logService.error('Failed to initialize core services:', error);
            throw error;
        });
        logService.info('Core infrastructure services initialized');

        // Initialize UI components
        await uiComponentService.initialize().catch(error => {
            logService.error('Failed to initialize UI components:', error);
            throw error;
        });
        logService.info('UI components initialized');

        // Initialize business logic services
        await Promise.all([
            userCardService.initialize(),
            darwinaService.initialize(),
            notificationService.initialize()
        ]).catch(error => {
            logService.error('Failed to initialize business services:', error);
            // Don't throw here - continue with limited functionality
        });
        logService.info('Business logic services initialized');

        // Initialize management services - these can fail gracefully
        await Promise.allSettled([
            statusCheckerService.initialize(),
            updateManagerService.initialize(),
            performanceMonitorService.initialize()
        ]).then(results => {
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    logService.error(`Management service ${index} failed:`, result.reason);
                }
            });
        });
        logService.info('Management services initialized');

        // Check authentication state
        const isAuthenticated = await darwinaService.checkAuthorization();
        if (!isAuthenticated) {
            logService.info('Application initialized in unauthenticated state');
            showLoginPrompt();
        } else {
            logService.info('Application initialized successfully');
            await loadInitialData();
        }

    } catch (error) {
        logService.error('Failed to initialize application:', error);
        showErrorState(error);
        notificationService.showError('Failed to initialize application');
    }
}

async function loadInitialData() {
    try {
        // Show loading state
        loadingService.show();

        // Load initial data in parallel
        const results = await Promise.allSettled([
            userCardService.refreshUserData(),
            statusCheckerService.checkAll()
        ]);

        // Handle results
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                logService.error(`Failed to load data ${index}:`, result.reason);
                notificationService.showWarning('Some data may be unavailable');
            }
        });

        logService.info('Initial data loaded successfully');
    } catch (error) {
        logService.error('Failed to load initial data:', error);
        notificationService.showWarning('Some data may be unavailable');
    } finally {
        loadingService.hide();
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', initializeServices);

function showLoginPrompt() {
    try {
        // Show login UI
        const loginContainer = document.getElementById('login-container');
        const mainContainer = document.getElementById('main-container');
        const errorContainer = document.getElementById('error-container');
        
        if (loginContainer && mainContainer && errorContainer) {
            // Hide other containers
            mainContainer.classList.add('hidden');
            errorContainer.classList.add('hidden');
            
            // Show login container
            loginContainer.classList.remove('hidden');
            
            // Show notification
            notificationService.show({
                title: 'Authentication Required',
                message: 'Please log in to continue',
                type: 'info'
            });
            
            // Setup login form if exists
            const loginForm = loginContainer.querySelector('form');
            if (loginForm) {
                loginForm.addEventListener('submit', handleLogin);
            }
        } else {
            logService.error('Required containers not found in DOM');
            throw new Error('Required containers not found');
        }
    } catch (error) {
        logService.error('Failed to show login prompt:', error);
        showErrorState(error);
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    try {
        loadingService.show();
        
        const formData = new FormData(event.target);
        const credentials = {
            username: formData.get('username'),
            password: formData.get('password')
        };
        
        // Attempt login
        const success = await darwinaService.login(credentials);
        
        if (success) {
            // Reload initial data
            await loadInitialData();
            
            // Show main container
            const loginContainer = document.getElementById('login-container');
            const mainContainer = document.getElementById('main-container');
            
            if (loginContainer && mainContainer) {
                loginContainer.classList.add('hidden');
                mainContainer.classList.remove('hidden');
            }
            
            notificationService.show({
                title: 'Welcome',
                message: 'Successfully logged in',
                type: 'success'
            });
        } else {
            notificationService.show({
                title: 'Login Failed',
                message: 'Invalid credentials',
                type: 'error'
            });
        }
    } catch (error) {
        logService.error('Login failed:', error);
        notificationService.showError('Failed to log in');
    } finally {
        loadingService.hide();
    }
}

function showErrorState(error) {
    // Show error UI
    const errorContainer = document.getElementById('error-container');
    const mainContainer = document.getElementById('main-container');
    
    if (errorContainer && mainContainer) {
        errorContainer.classList.remove('hidden');
        mainContainer.classList.add('hidden');
        
        const errorMessage = errorContainer.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.textContent = error.message || 'Failed to initialize application';
        }
    }
}

