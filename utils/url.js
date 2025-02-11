/**
 * Update URL parameters without reloading the page
 * @param {Object} params - Parameters to update
 * @param {boolean} [replace=false] - Whether to replace history state instead of pushing
 */
export function updateUrlParameters(params, replace = false) {
    try {
        const url = new URL(window.location.href);
        const searchParams = url.searchParams;

        // Remove undefined or null parameters
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null) {
                searchParams.delete(key);
            } else {
                searchParams.set(key, value);
            }
        });

        // Update URL without reloading
        const newUrl = `${url.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
        if (replace) {
            window.history.replaceState({}, '', newUrl);
        } else {
            window.history.pushState({}, '', newUrl);
        }
    } catch (error) {
        console.error('Failed to update URL parameters:', error);
    }
}

/**
 * Get current URL parameters
 * @returns {Object} Object containing URL parameters
 */
export function getUrlParameters() {
    const params = {};
    try {
        const searchParams = new URLSearchParams(window.location.search);
        for (const [key, value] of searchParams.entries()) {
            params[key] = value;
        }
    } catch (error) {
        console.error('Failed to get URL parameters:', error);
    }
    return params;
}

/**
 * Clear all URL parameters
 * @param {boolean} [replace=true] - Whether to replace history state instead of pushing
 */
export function clearUrlParameters(replace = true) {
    try {
        const url = new URL(window.location.href);
        if (replace) {
            window.history.replaceState({}, '', url.pathname);
        } else {
            window.history.pushState({}, '', url.pathname);
        }
    } catch (error) {
        console.error('Failed to clear URL parameters:', error);
    }
} 