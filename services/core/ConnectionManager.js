import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';

export class ConnectionManager extends BaseManager {
    constructor() {
        super();
        this._connected = false;
        this._port = null;
        this._connectionCheckInterval = null;
        this._pendingMessages = new Map();
        this._messageBuffer = new Map();
        this._messageTimeout = 30000; // 30 seconds timeout for messages
        this._maxRetries = 3;
        this._retryDelay = 1000;
        this._connectionAttempts = 0;
        this._maxConnectionAttempts = 5;
        this._isReconnecting = false;
        this._syncState = {
            lastSyncTime: 0,
            syncInterval: 5000, // 5 seconds
            pendingSyncs: new Set()
        };
    }

    async initialize() {
        try {
            await super.initialize();
            await this._setupConnection();
            this._startConnectionCheck();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.CONNECTION, ErrorSeverity.WARNING, {
                method: 'initialize',
                context: 'Initial connection setup failed'
            });
            return false;
        }
    }

    isConnected() {
        return this._connected && this._port && !this._port.error;
    }

    async sendMessage(message, options = {}) {
        const messageId = crypto.randomUUID();
        const timeout = options.timeout || this._messageTimeout;
        
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this._pendingMessages.delete(messageId);
                if (options.shouldBuffer) {
                    this._bufferMessage(messageId, message, options);
                }
                reject(new Error('Message timeout'));
            }, timeout);

            this._pendingMessages.set(messageId, {
                message,
                resolve,
                reject,
                timeoutId,
                timestamp: Date.now(),
                retries: 0
            });

            if (this.isConnected()) {
                this._sendMessageToPort(messageId, message);
            } else if (options.shouldBuffer) {
                this._bufferMessage(messageId, message, options);
                reject(new Error('Connection not available - message buffered'));
            } else {
                this._pendingMessages.delete(messageId);
                clearTimeout(timeoutId);
                reject(new Error('Connection not available'));
            }
        });
    }

    _bufferMessage(messageId, message, options) {
        const bufferKey = options.bufferKey || 'default';
        if (!this._messageBuffer.has(bufferKey)) {
            this._messageBuffer.set(bufferKey, new Map());
        }
        
        const buffer = this._messageBuffer.get(bufferKey);
        buffer.set(messageId, {
            message,
            timestamp: Date.now(),
            priority: options.priority || 'normal',
            expiresAt: options.expireAfter ? Date.now() + options.expireAfter : null
        });

        // Clean up expired messages
        this._cleanupBuffer(bufferKey);
    }

    _cleanupBuffer(bufferKey) {
        const buffer = this._messageBuffer.get(bufferKey);
        if (!buffer) return;

        const now = Date.now();
        for (const [messageId, entry] of buffer.entries()) {
            if (entry.expiresAt && now > entry.expiresAt) {
                buffer.delete(messageId);
            }
        }
    }

    async _processPendingMessages() {
        if (!this.isConnected()) {
            return;
        }

        // Process buffered messages first
        for (const [bufferKey, buffer] of this._messageBuffer.entries()) {
            const messages = [...buffer.entries()]
                .sort((a, b) => {
                    // Sort by priority and then by timestamp
                    if (a[1].priority === b[1].priority) {
                        return a[1].timestamp - b[1].timestamp;
                    }
                    return a[1].priority === 'high' ? -1 : 1;
                });

            for (const [messageId, entry] of messages) {
                try {
                    await this.sendMessage(entry.message, {
                        timeout: this._messageTimeout,
                        shouldBuffer: false
                    });
                    buffer.delete(messageId);
                } catch (error) {
                    console.warn(`Failed to send buffered message ${messageId}:`, error);
                }
            }
        }

        // Process regular pending messages
        for (const [messageId, { message, resolve, reject, timeoutId }] of this._pendingMessages) {
            try {
                this._sendMessageToPort(messageId, message);
            } catch (error) {
                clearTimeout(timeoutId);
                this._pendingMessages.delete(messageId);
                reject(error);
            }
        }
    }

    _sendMessageToPort(messageId, message) {
        if (!this._port) {
            throw new Error('Port not available');
        }

        this._port.postMessage({
            id: messageId,
            ...message,
            _sync: {
                timestamp: Date.now(),
                attempt: this._pendingMessages.get(messageId)?.retries || 0
            }
        });
    }

    async _synchronizeState() {
        if (!this.isConnected() || 
            Date.now() - this._syncState.lastSyncTime < this._syncState.syncInterval) {
            return;
        }

        try {
            const syncId = crypto.randomUUID();
            this._syncState.pendingSyncs.add(syncId);

            await this.sendMessage({
                type: 'STATE_SYNC_REQUEST',
                syncId
            }, {
                timeout: 5000,
                shouldBuffer: false
            });

            this._syncState.lastSyncTime = Date.now();
        } catch (error) {
            console.warn('State synchronization failed:', error);
        }
    }

    _handleResponse(messageId, response) {
        const pending = this._pendingMessages.get(messageId);
        if (pending) {
            clearTimeout(pending.timeoutId);
            this._pendingMessages.delete(messageId);
            pending.resolve(response);
        }
    }

    async _setupConnection() {
        if (this._isReconnecting) {
            return;
        }

        try {
            this._isReconnecting = true;
            
            // Cleanup existing connection if any
            if (this._port) {
                this._port.disconnect();
                this._port = null;
            }

            // Check if service worker is ready
            const serviceWorkerState = await this._checkServiceWorkerState();
            if (!serviceWorkerState.ready) {
                console.warn('[WARNING] ⚠️ Service worker not ready:', serviceWorkerState.error);
                throw new Error(`Service worker not ready: ${serviceWorkerState.error}`);
            }

            // Create new connection with retry mechanism
            let retryCount = 0;
            while (retryCount < this._maxRetries) {
                try {
                    this._port = chrome.runtime.connect({ name: 'popup' });
                    
                    // Verify connection immediately
                    const isConnected = await new Promise((resolve) => {
                        const timeout = setTimeout(() => resolve(false), 1000);
                        
                        const verifyConnection = (msg) => {
                            if (msg.type === 'PONG') {
                                this._port.onMessage.removeListener(verifyConnection);
                                clearTimeout(timeout);
                                resolve(true);
                            }
                        };
                        
                        this._port.onMessage.addListener(verifyConnection);
                        this._port.postMessage({ type: 'PING' });
                    });

                    if (isConnected) {
                        // Setup message listener after successful connection
                        this._port.onMessage.addListener((message) => {
                            this._handleMessage(message);
                        });

                        // Setup disconnect listener
                        this._port.onDisconnect.addListener(() => {
                            const error = chrome.runtime.lastError;
                            if (error) {
                                console.warn('[WARNING] ⚠️ Port disconnected with error:', { 
                                    message: error.message,
                                    timestamp: new Date().toISOString()
                                });
                            }
                            this._handleDisconnect();
                        });

                        this._connected = true;
                        this._connectionAttempts = 0;
                        
                        // Process any pending messages
                        await this._processPendingMessages();
                        
                        console.log('[INFO] 🔌 Connection established successfully');
                        break;
                    } else {
                        throw new Error('Connection verification failed');
                    }
                } catch (error) {
                    retryCount++;
                    if (retryCount === this._maxRetries) {
                        throw error;
                    }
                    await new Promise(resolve => setTimeout(resolve, this._retryDelay * Math.pow(2, retryCount)));
                }
            }
            
        } catch (error) {
            this.handleError(error, ErrorType.CONNECTION, ErrorSeverity.WARNING, {
                method: '_setupConnection',
                attempt: this._connectionAttempts,
                timestamp: new Date().toISOString()
            });
            await this._handleConnectionError();
        } finally {
            this._isReconnecting = false;
        }
    }

    async _checkServiceWorkerState() {
        try {
            // W Manifest V3 nie używamy już getBackgroundPage
            // Zamiast tego sprawdzamy czy możemy nawiązać połączenie
            return new Promise((resolve) => {
                try {
                    // Próba wysłania pustej wiadomości do sprawdzenia połączenia
                    chrome.runtime.sendMessage({ type: 'PING' }, response => {
                        const error = chrome.runtime.lastError;
                        if (error) {
                            resolve({ 
                                ready: false, 
                                error: error.message 
                            });
                        } else {
                            resolve({ ready: true });
                        }
                    });
                } catch (error) {
                    resolve({ 
                        ready: false, 
                        error: error.message || 'Failed to check service worker state' 
                    });
                }
            });
        } catch (error) {
            return { 
                ready: false, 
                error: error.message || 'Failed to check service worker state' 
            };
        }
    }

    async _handleConnectionError() {
        this._connected = false;
        this._connectionAttempts++;

        if (this._connectionAttempts < this._maxConnectionAttempts) {
            const delay = Math.min(1000 * Math.pow(2, this._connectionAttempts - 1), 30000);
            await new Promise(resolve => setTimeout(resolve, delay));
            await this._setupConnection();
        } else {
            this.handleError(
                new Error('Max connection attempts reached'),
                ErrorType.CONNECTION,
                ErrorSeverity.ERROR,
                { method: '_handleConnectionError' }
            );
        }
    }

    _handleDisconnect() {
        this._connected = false;
        this._port = null;
        
        // Reject all pending messages
        for (const [id, { reject }] of this._pendingMessages) {
            reject(new Error('Connection lost'));
            this._pendingMessages.delete(id);
        }
    }

    _startConnectionCheck() {
        if (this._connectionCheckInterval) {
            clearInterval(this._connectionCheckInterval);
        }

        this._connectionCheckInterval = setInterval(() => {
            if (!this._connected && !this._isReconnecting) {
                this._setupConnection();
            }
        }, 30000); // Check every 30 seconds
    }

    async _reconnect() {
        if (!this.isConnected()) {
            this._setupConnection();
            // Wait for connection to establish
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 5000);

                const onConnect = () => {
                    clearTimeout(timeout);
                    this.off('connected', onConnect);
                    this.off('connectionLost', onError);
                    resolve();
                };

                const onError = () => {
                    clearTimeout(timeout);
                    this.off('connected', onConnect);
                    this.off('connectionLost', onError);
                    reject(new Error('Connection failed'));
                };

                this.on('connected', onConnect);
                this.on('connectionLost', onError);
            });
        }
    }

    async dispose() {
        try {
            if (this._connectionCheckInterval) {
                clearInterval(this._connectionCheckInterval);
                this._connectionCheckInterval = null;
            }

            if (this._port) {
                this._port.disconnect();
                this._port = null;
            }

            // Clear pending messages
            for (const { timeoutId } of this._pendingMessages.values()) {
                clearTimeout(timeoutId);
            }
            this._pendingMessages.clear();

            this._connected = false;
            
            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.CONNECTION, ErrorSeverity.WARNING);
        }
    }

    _handleMessage(message) {
        if (message.type === 'STATE_SYNC_RESPONSE' && 
            this._syncState.pendingSyncs.has(message.syncId)) {
            this._syncState.pendingSyncs.delete(message.syncId);
            this.emit('stateSync', message.state);
        } else if (message.id && this._pendingMessages.has(message.id)) {
            this._handleResponse(message.id, message.data);
        }
        this.emit('message', message);
    }
} 