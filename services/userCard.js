import { ACTIVE_USERS, getUserByMemberId, generateUserJson, saveUserFile } from './users.js';
import { BaseManager } from './core/BaseManager.js';
import { LogLevel, ErrorType, ErrorSeverity } from './core/EventType.js';

export class UserCardService extends BaseManager {
    static #instance = null;
    #currentUser = null;
    #cache = new Map();
    
    // Stałe dla kluczy storage
    static STORAGE_KEYS = {
        USERS_DATA: 'darwin_users_data',
        CURRENT_USER: 'darwin_current_user',
        QR_CODE_PREFIX: 'qr_code_'
    };

    // Stałe dla selektorów
    static SELECTORS = {
        USER_SELECT: '#user-select',
        CARD_INNER: '.user-card-inner',
        USER_NAME: '.user-card-front .user-name',
        QR_CODE: '.user-card-back .qr-code'
    };

    // Stałe dla assetów
    static ASSETS = {
        DEFAULT_AVATAR: 'assets/default-avatar.jpg',
        QR_CODES_DIR: 'qrcodes'
    };

    // Stałe dla walidacji
    static REQUIRED_FIELDS = {
        USER: ['memberId', 'firstName', 'fullName', 'qrCodeUrl'],
        FILE: ['firstName', 'memberId', 'fullName']
    };

    constructor() {
        if (UserCardService.#instance) {
            return UserCardService.#instance;
        }
        super('UserCardService');
        UserCardService.#instance = this;
    }

    static getInstance() {
        if (!UserCardService.#instance) {
            UserCardService.#instance = new UserCardService();
        }
        return UserCardService.#instance;
    }

    async saveUserData(userData) {
        try {
            // Validate required fields
            this.#validateUserData(userData, UserCardService.REQUIRED_FIELDS.USER);
            
            const data = await chrome.storage.local.get(UserCardService.STORAGE_KEYS.USERS_DATA);
            let users = data[UserCardService.STORAGE_KEYS.USERS_DATA] || {};
            
            const existingUser = users[userData.memberId];
            const isNewQRCode = !existingUser || existingUser.qrCodeUrl !== userData.qrCodeUrl;
            
            // Merge with existing data
            const baseUserData = await this.getUserByMemberId(userData.memberId);
            const mergedData = {
                ...baseUserData,
                ...userData,
                lastLoginTime: new Date().toISOString(),
                notificationShown: existingUser?.notificationShown || false,
                lastUpdate: Date.now()
            };

            // Save to storage
            users[userData.memberId] = mergedData;
            await chrome.storage.local.set({
                [UserCardService.STORAGE_KEYS.USERS_DATA]: users,
                [UserCardService.STORAGE_KEYS.CURRENT_USER]: userData.memberId
            });

            // Update cache
            this.#cache.set(userData.memberId, mergedData);
            this.#currentUser = mergedData;

            // Save file and update card
            await Promise.all([
                this.saveUserFile(mergedData),
                this.updateUserCard(mergedData)
            ]);

            return isNewQRCode;
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.MEDIUM, {
                method: 'saveUserData',
                userId: userData?.memberId
            });
            throw error;
        }
    }

    async loadCurrentUser() {
        try {
            // Use getCurrentUser to maintain consistency
            const currentUser = await this.getCurrentUser();
            if (currentUser) {
                await this.updateUserCard(currentUser);
                return currentUser;
            }
            
            await this.updateUserCard(null);
            return null;
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Error loading current user:', error);
            await this.updateUserCard(null);
            return null;
        }
    }

    async getAllUsers() {
        try {
            const data = await chrome.storage.local.get(UserCardService.STORAGE_KEYS.USERS_DATA);
            return data[UserCardService.STORAGE_KEYS.USERS_DATA] || {};
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Error loading users data:', error);
            return {};
        }
    }

    async setCurrentUser(userId) {
        try {
            if (!userId) {
                this.#currentUser = null;
                this.#cache.delete(userId);
                await chrome.storage.local.remove(UserCardService.STORAGE_KEYS.CURRENT_USER);
                await this.updateUserCard(null);
                return true;
            }

            // Try cache first
            let userData = this.#cache.get(userId);
            if (!userData) {
                userData = await this.getUserByMemberId(userId);
                if (!userData) {
                    throw new Error(`Nie znaleziono użytkownika o ID: ${userId}`);
                }
                this.#cache.set(userId, userData);
            }

            // Validate and update
            this.#validateUserData(userData, UserCardService.REQUIRED_FIELDS.USER);
            this.#currentUser = userData;

            // Update storage and UI
            await Promise.all([
                chrome.storage.local.set({ 
                    [UserCardService.STORAGE_KEYS.CURRENT_USER]: userId 
                }),
                this.updateUserCard(userData)
            ]);

            // Emit event
            this.eventManager?.emit('user:changed', {
                userId,
                userData,
                timestamp: Date.now()
            });

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.MEDIUM, {
                method: 'setCurrentUser',
                userId
            });
            throw error;
        }
    }

    async markNotificationShown(userId) {
        try {
            const data = await chrome.storage.local.get(UserCardService.STORAGE_KEYS.USERS_DATA);
            const users = data[UserCardService.STORAGE_KEYS.USERS_DATA] || {};
            
            if (users[userId]) {
                users[userId].notificationShown = true;
                await chrome.storage.local.set({ [UserCardService.STORAGE_KEYS.USERS_DATA]: users });
                await this.saveUserFile(users[userId]);
                
                // Jeśli to aktualny użytkownik, aktualizuj kartę
                const currentUser = await this.loadCurrentUser();
                if (currentUser && currentUser.memberId === userId) {
                    await this.updateUserCard(users[userId]);
                }
            }
        } catch (error) {
            console.error('Error marking notification as shown:', error);
        }
    }

    async initializeUserSelector() {
        try {
            const userSelector = document.querySelector(UserCardService.SELECTORS.USER_SELECT);
            if (!userSelector) {
                this.log(LogLevel.WARNING, '⚠️ User selector element not found');
                return;
            }

            // Clear existing options
            userSelector.innerHTML = '';

            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Wybierz użytkownika';
            userSelector.appendChild(defaultOption);

            try {
                // Get active users and sort them by name
                const activeUsers = [...ACTIVE_USERS].sort((a, b) => 
                    a.fullName.localeCompare(b.fullName)
                );

                // Add options for each active user
                for (const user of activeUsers) {
                    const option = document.createElement('option');
                    option.value = user.memberId;
                    option.textContent = user.fullName;
                    userSelector.appendChild(option);
                }

                this.log(LogLevel.DEBUG, `📋 Loaded ${activeUsers.length} users into selector`);
            } catch (error) {
                this.handleError(error, ErrorType.DATA, ErrorSeverity.MEDIUM, {
                    method: 'initializeUserSelector',
                    context: 'Loading active users'
                });
            }

            // Load and set current user if exists
            const currentUser = await this.getCurrentUser();
            if (currentUser) {
                userSelector.value = currentUser.memberId;
                await this.updateUserCard(currentUser);
                this.log(LogLevel.DEBUG, `👤 Set current user: ${currentUser.fullName}`);
            } else {
                // Explicitly update card with no user
                await this.updateUserCard(null);
            }

            // Add change listener
            userSelector.addEventListener('change', async (event) => {
                try {
                    const userId = event.target.value;
                    const previousValue = userSelector.dataset.previousValue;
                    
                    // Update selector state
                    userSelector.disabled = true;
                    userSelector.dataset.previousValue = userId;

                    try {
                        if (!userId) {
                            // Handle empty selection
                            await this.updateUserCard(null);
                            await this.changeUser(null);
                        } else {
                            await this.changeUser(userId);
                        }
                        this.log(LogLevel.INFO, `✅ User ${userId ? 'changed to: ' + userId : 'cleared'}`);
                    } catch (error) {
                        // Restore previous selection on error
                        userSelector.value = previousValue;
                        throw error;
                    } finally {
                        userSelector.disabled = false;
                    }
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                        method: 'userSelector.onChange',
                        userId: event.target.value
                    });
                }
            });

            this.log(LogLevel.SUCCESS, '✨ User selector initialized successfully');
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initializeUserSelector'
            });
            throw error;
        }
    }

    async getCurrentUser() {
        try {
            if (this.#currentUser) {
                return this.#currentUser;
            }

            const data = await chrome.storage.local.get(UserCardService.STORAGE_KEYS.CURRENT_USER);
            const userId = data[UserCardService.STORAGE_KEYS.CURRENT_USER];
            
            if (!userId) {
                return null;
            }

            // Try cache first
            if (this.#cache.has(userId)) {
                this.#currentUser = this.#cache.get(userId);
                return this.#currentUser;
            }

            // Load from file
            this.#currentUser = await this.getUserByMemberId(userId);
            if (this.#currentUser) {
                this.#cache.set(userId, this.#currentUser);
            }

            return this.#currentUser;
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.LOW, {
                method: 'getCurrentUser'
            });
            return null;
        }
    }

    async changeUser(userId) {
        try {
            if (!userId) {
                this.#currentUser = null;
                this.#cache.delete(userId);
                await chrome.storage.local.remove(UserCardService.STORAGE_KEYS.CURRENT_USER);
                await this.updateUserCard(null);
                return true;
            }

            // Try cache first
            let userData = this.#cache.get(userId);
            if (!userData) {
                // Get user from ACTIVE_USERS first
                userData = ACTIVE_USERS.find(user => user.memberId === userId);
                if (!userData) {
                    // Fallback to file-based data
                    userData = await this.getUserByMemberId(userId);
                }
                if (!userData) {
                    throw new Error(`User not found: ${userId}`);
                }

                // Ensure all required fields are present
                const firstName = userData.firstName || userData.fullName.split(' ')[0];
                const qrCodeUrl = userData.qrCodeUrl || `qrcodes/${userId}.png`;
                
                // Create complete user data object
                userData = {
                    ...userData,
                    firstName,
                    qrCodeUrl,
                    memberId: userId,
                    lastUpdate: Date.now()
                };

                this.#cache.set(userId, userData);
            }

            // Validate user data
            this.#validateUserData(userData, UserCardService.REQUIRED_FIELDS.USER);

            this.#currentUser = userData;
            await chrome.storage.local.set({ 
                [UserCardService.STORAGE_KEYS.CURRENT_USER]: userId 
            });
            await this.updateUserCard(userData);
            
            // Emit event
            this.eventManager?.emit('user:changed', { 
                userId,
                userData,
                timestamp: Date.now()
            });
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.MEDIUM, {
                method: 'changeUser',
                userId
            });
            throw error;
        }
    }

    // Add private validation method
    #validateUserData(userData, requiredFields) {
        if (!userData || typeof userData !== 'object') {
            throw new Error('Invalid user data');
        }

        const missingFields = requiredFields.filter(field => !userData[field]);
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
    }

    // Add QR code caching
    async #getQRCodeUrl(userId) {
        try {
            const cacheKey = `qr_code_${userId}`;
            const cached = await chrome.storage.local.get(cacheKey);
            
            if (cached[cacheKey]) {
                return cached[cacheKey];
            }

            const qrPath = `qrcodes/${userId}.png`;
            const url = chrome.runtime.getURL(qrPath);
            
            // Cache the URL
            await chrome.storage.local.set({ [cacheKey]: url });
            
            return url;
        } catch (error) {
            this.log(LogLevel.ERROR, `❌ Error getting QR code URL for user ${userId}:`, error);
            return null;
        }
    }

    async updateUserCard(userData = null) {
        const cardInner = document.querySelector(UserCardService.SELECTORS.CARD_INNER);
        const nameElement = document.querySelector(UserCardService.SELECTORS.USER_NAME);
        const qrElement = document.querySelector(UserCardService.SELECTORS.QR_CODE);
        
        try {
            if (!userData) {
                const defaultText = 'Wybierz użytkownika';
                if (nameElement) {
                    nameElement.textContent = defaultText;
                    nameElement.title = defaultText;
                }
                if (qrElement) {
                    qrElement.src = chrome.runtime.getURL(UserCardService.ASSETS.DEFAULT_AVATAR);
                    qrElement.alt = 'Domyślny avatar';
                }
                if (cardInner) {
                    cardInner.classList.add('no-user');
                    cardInner.dataset.userId = '';
                    cardInner.dataset.lastUpdate = Date.now().toString();
                }
                this.log(LogLevel.DEBUG, '🔄 User card reset to default state');
                return;
            }

            // Validate user data
            this.#validateUserData(userData, UserCardService.REQUIRED_FIELDS.USER);

            // Update name
            if (nameElement) {
                nameElement.textContent = userData.fullName;
                nameElement.title = userData.fullName;
            }
            
            // Update QR code
            if (qrElement) {
                const qrUrl = await this.#getQRCodeUrl(userData.memberId); // Changed from id to memberId
                if (qrUrl) {
                    qrElement.src = qrUrl;
                    qrElement.alt = `QR kod użytkownika ${userData.fullName}`;
                    qrElement.style.maxWidth = 'none';
                    qrElement.style.width = '100%';
                } else {
                    qrElement.src = chrome.runtime.getURL(UserCardService.ASSETS.DEFAULT_AVATAR);
                    qrElement.alt = 'Domyślny avatar';
                }
                
                qrElement.onerror = () => {
                    this.log(LogLevel.ERROR, `Failed to load QR code for user ${userData.memberId}`);
                    qrElement.src = chrome.runtime.getURL(UserCardService.ASSETS.DEFAULT_AVATAR);
                    qrElement.alt = 'Domyślny avatar (błąd ładowania QR)';
                };
            }
            
            // Update card state
            if (cardInner) {
                cardInner.classList.remove('no-user');
                cardInner.dataset.userId = userData.memberId;
                cardInner.dataset.lastUpdate = Date.now().toString();
            }

            this.log(LogLevel.DEBUG, `🔄 User card updated for: ${userData.fullName}`);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'updateUserCard',
                userId: userData?.memberId
            });
            throw error;
        }
    }

    async getUserByMemberId(memberId) {
        try {
            // First try to get from ACTIVE_USERS
            let userData = ACTIVE_USERS.find(user => user.memberId === memberId);
            if (userData) {
                const firstName = userData.firstName || userData.fullName.split(' ')[0];
                const qrCodeUrl = userData.qrCodeUrl || `qrcodes/${memberId}.png`;
                
                return {
                    ...userData,
                    firstName,
                    qrCodeUrl,
                    memberId,
                    lastUpdate: Date.now()
                };
            }

            // Fallback to file-based data
            const response = await fetch(chrome.runtime.getURL(`users/${memberId}.json`));
            if (!response.ok) {
                throw new Error(`User not found: ${memberId}`);
            }
            userData = await response.json();
            
            // Ensure required fields
            const firstName = userData.firstName || userData.fullName.split(' ')[0];
            const qrCodeUrl = userData.qrCodeUrl || `qrcodes/${memberId}.png`;
            
            return {
                ...userData,
                firstName,
                qrCodeUrl,
                memberId,
                lastUpdate: Date.now()
            };
        } catch (error) {
            this.log(LogLevel.ERROR, `Error fetching user data: ${error.message}`);
            return null;
        }
    }

    async saveUserFile(userData) {
        try {
            // Validate required fields
            const requiredFields = ['firstName', 'memberId', 'fullName'];
            const missingFields = requiredFields.filter(field => !userData[field]);
            
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }

            const fileName = `${userData.firstName}-${userData.memberId}.json`;
            const fileContent = JSON.stringify({
                ...userData,
                exportDate: new Date().toISOString(),
                version: '1.0'
            }, null, 2);

            const blob = new Blob([fileContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            try {
                await chrome.downloads.download({
                    url: url,
                    filename: `users/${fileName}`,
                    saveAs: false,
                    conflictAction: 'overwrite'
                });
                
                this.log(LogLevel.INFO, `✅ User file saved: ${fileName}`);
            } finally {
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Error saving user file:', error);
            throw error;
        }
    }

    // Add cleanup method
    async cleanup() {
        try {
            // Clear user data cache
            const cacheKeys = await chrome.storage.local.get(null);
            const qrCacheKeys = Object.keys(cacheKeys).filter(key => key.startsWith('qr_code_'));
            
            if (qrCacheKeys.length > 0) {
                await chrome.storage.local.remove(qrCacheKeys);
            }
            
            this.log(LogLevel.INFO, '🧹 UserCardService cleanup completed');
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Error during cleanup:', error);
        }
    }
} 