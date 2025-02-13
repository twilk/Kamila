/**
 * Environment configuration for Chrome extension
 */

// Environment detection
const checkChrome = () => {
    try {
        return typeof chrome !== 'undefined' && 
               chrome.runtime && 
               chrome.runtime.id;
    } catch (e) {
        return false;
    }
};

// Development mode detection
const isDevelopment = (() => {
    try {
        return !chrome.runtime.getManifest().update_url;
    } catch (e) {
        return false;
    }
})();

// Environment configuration
export const environment = {
    // Extension info
    extensionId: chrome.runtime.id,
    manifestVersion: chrome.runtime.getManifest().version,
    isDevelopment,
    isProduction: !isDevelopment,
    
    // API configuration
    apiUrl: isDevelopment ? 'https://dev.darwina.pl/api' : 'https://darwina.pl/api',
    
    // Feature flags
    features: {
        debug: isDevelopment,
        metrics: true,
        cache: true
    }
};

// Export default configuration
export default environment; 