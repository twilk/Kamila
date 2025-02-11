/**
 * Initialize message port connection with background script
 */
function initializeMessagePort() {
    try {
        // Connect to background script
        const port = chrome.runtime.connect({ name: 'popup' });
        
        // Listen for messages
        port.onMessage.addListener((message) => {
            try {
                handleBackgroundMessage(message);
            } catch (error) {
                console.error('Error handling background message:', error);
            }
        });

        // Handle disconnection
        port.onDisconnect.addListener(() => {
            console.log('Disconnected from background script');
        });

        return port;
    } catch (error) {
        console.error('Error initializing message port:', error);
        return null;
    }
}

/**
 * Handle messages from background script
 * @param {Object} message Message from background
 */
function handleBackgroundMessage(message) {
    const { type, payload } = message;
    
    console.log('Received message from background:', { type, payload });

    switch (type) {
        case 'STATE_UPDATE':
            handleStateUpdate(payload);
            break;
        case 'PROGRESS_UPDATE':
            handleProgressUpdate(payload);
            break;
        case 'ERROR':
            handleError(payload);
            break;
        default:
            console.warn('Unknown message type:', type);
    }
}

/**
 * Handle state updates from background
 * @param {Object} state Updated state
 */
function handleStateUpdate(state) {
    try {
        // Update UI based on state
        if (state.user) {
            updateUserInfo(state.user);
        }
        if (state.store) {
            updateStoreInfo(state.store);
        }
    } catch (error) {
        console.error('Error handling state update:', error);
    }
}

/**
 * Handle progress updates from background
 * @param {Object} progress Progress data
 */
function handleProgressUpdate(progress) {
    try {
        const { operation, current, total, status } = progress;
        
        // Update progress bar
        const progressBar = document.querySelector(`[data-operation="${operation}"]`);
        if (progressBar) {
            progressBar.style.width = `${(current / total) * 100}%`;
            progressBar.setAttribute('aria-valuenow', current);
            progressBar.setAttribute('aria-valuemax', total);
        }

        // Update status text
        const statusElement = document.querySelector(`[data-operation-status="${operation}"]`);
        if (statusElement) {
            statusElement.textContent = status;
        }
    } catch (error) {
        console.error('Error handling progress update:', error);
    }
}

/**
 * Handle error messages from background
 * @param {Object} error Error data
 */
function handleError(error) {
    try {
        const { message, type, severity } = error;
        
        // Show error in UI
        const alertElement = document.createElement('div');
        alertElement.className = `alert alert-${severity === 'HIGH' ? 'danger' : 'warning'} alert-dismissible fade show`;
        alertElement.innerHTML = `
            <strong>${type}:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        document.querySelector('#alerts-container').appendChild(alertElement);
    } catch (error) {
        console.error('Error handling error message:', error);
    }
}

// Initialize message port when popup loads
document.addEventListener('DOMContentLoaded', () => {
    initializeMessagePort();
}); 