import { ACTIVE_USERS, getUserByMemberId, generateUserJson, saveUserFile } from './users.js';
import { BaseManager } from './baseManager.js';

export class UserCardService extends BaseManager {
    static #instance = null;
    #currentUser = null;

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
        if (!userData || !userData.memberId || !userData.qrCodeUrl) return false;
        
        try {
            const data = await chrome.storage.local.get('darwin_users_data');
            let users = data.darwin_users_data || {};
            
            const existingUser = users[userData.memberId];
            const isNewQRCode = !existingUser || existingUser.qrCodeUrl !== userData.qrCodeUrl;
            
            // Połącz z istniejącymi danymi
            const baseUserData = await this.getUserByMemberId(userData.memberId);
            const mergedData = {
                ...baseUserData,
                ...userData,
                lastLoginTime: new Date().toISOString(),
                notificationShown: existingUser?.notificationShown || false
            };

            // Zapisz do storage
            users[userData.memberId] = mergedData;
            await chrome.storage.local.set({
                'darwin_users_data': users,
                'darwin_current_user': userData.memberId
            });

            // Zapisz plik
            await this.saveUserFile(mergedData);

            // Aktualizuj kartę użytkownika
            await this.updateUserCard(mergedData);

            return isNewQRCode;
        } catch (error) {
            console.error('Error saving user data:', error);
            return false;
        }
    }

    async loadCurrentUser() {
        try {
            const data = await chrome.storage.local.get(['darwin_current_user', 'darwin_users_data']);
            const currentUserId = data.darwin_current_user;
            const users = data.darwin_users_data || {};
            
            if (currentUserId && users[currentUserId]) {
                const userData = users[currentUserId];
                await this.updateUserCard(userData);
                return userData;
            }

            if (currentUserId) {
                const userData = await this.getUserByMemberId(currentUserId);
                if (userData) {
                    await this.updateUserCard(userData);
                    return userData;
                }
            }

            await this.updateUserCard(null);
            return null;
        } catch (error) {
            console.error('Error loading current user:', error);
            await this.updateUserCard(null);
            return null;
        }
    }

    async getAllUsers() {
        try {
            const data = await chrome.storage.local.get('darwin_users_data');
            return data.darwin_users_data || {};
        } catch (error) {
            console.error('Error loading users data:', error);
            return {};
        }
    }

    async setCurrentUser(userId) {
        try {
            if (!userId) {
                await chrome.storage.local.remove('darwin_current_user');
                await this.updateUserCard(null);
                return true;
            }

            const userData = await this.getUserByMemberId(userId);
            if (!userData) {
                throw new Error(`Nie znaleziono użytkownika o ID: ${userId}`);
            }

            await chrome.storage.local.set({ 'darwin_current_user': userId });
            await this.updateUserCard(userData);
            return true;
        } catch (error) {
            console.error('Error setting current user:', error);
            return false;
        }
    }

    async markNotificationShown(userId) {
        try {
            const data = await chrome.storage.local.get('darwin_users_data');
            const users = data.darwin_users_data || {};
            
            if (users[userId]) {
                users[userId].notificationShown = true;
                await chrome.storage.local.set({ 'darwin_users_data': users });
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
            const userSelector = document.getElementById('user-selector');
            if (!userSelector) {
                this.log(LogLevel.WARNING, '⚠️ User selector element not found');
                return;
            }

            // Load current user
            const currentUser = await this.getCurrentUser();
            if (currentUser) {
                userSelector.value = currentUser.id;
            }

            // Add change listener
            userSelector.addEventListener('change', async (event) => {
                try {
                    const userId = event.target.value;
                    await this.changeUser(userId);
                } catch (error) {
                    this.errorHandler?.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM);
                }
            });

            this.log(LogLevel.INFO, '✅ User selector initialized');
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Failed to initialize user selector:', error);
            throw error;
        }
    }

    async getCurrentUser() {
        try {
            if (!this.#currentUser) {
                const data = await chrome.storage.local.get('currentUser');
                this.#currentUser = data.currentUser || null;
            }
            return this.#currentUser;
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Failed to get current user:', error);
            return null;
        }
    }

    async changeUser(userId) {
        try {
            // Update storage
            await chrome.storage.local.set({ currentUser: { id: userId } });
            this.#currentUser = { id: userId };
            
            // Emit event
            this.eventManager?.emit('user:changed', { userId });
            
            this.log(LogLevel.INFO, '✅ User changed successfully');
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Failed to change user:', error);
            throw error;
        }
    }

    async updateUserCard(userData = null) {
        const cardInner = document.querySelector('.user-card-inner');
        const nameElement = document.querySelector('.user-card-front .user-name');
        const qrElement = document.querySelector('.user-card-back .qr-code');
        
        try {
            if (!userData) {
                if (nameElement) {
                    nameElement.textContent = 'Wybierz użytkownika';
                }
                if (qrElement) {
                    qrElement.src = chrome.runtime.getURL('assets/default-avatar.jpg');
                }
                if (cardInner) {
                    cardInner.classList.add('no-user');
                }
                return;
            }

            if (nameElement) {
                nameElement.textContent = userData.fullName;
            }
            
            if (qrElement && userData.qrCodeUrl) {
                qrElement.src = `https://docs.google.com/thumbnail?id=${userData.qrCodeUrl}&sz=s1000`;
                qrElement.style.maxWidth = 'none';
                qrElement.style.width = '100%';
            }
            
            if (cardInner) {
                cardInner.classList.remove('no-user');
            }
        } catch (error) {
            console.error('Error updating user card:', error);
        }
    }

    async getUserByMemberId(memberId) {
        try {
            const response = await fetch(chrome.runtime.getURL(`users/${memberId}.json`));
            if (!response.ok) {
                throw new Error(`User not found: ${memberId}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error fetching user data: ${error.message}`);
            return null;
        }
    }

    async saveUserFile(userData) {
        try {
            const fileName = `${userData.firstName}-${userData.memberId}.json`;
            const fileContent = JSON.stringify({
                ...userData,
                exportDate: new Date().toISOString()
            }, null, 2);

            const blob = new Blob([fileContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            await chrome.downloads.download({
                url: url,
                filename: `users/${fileName}`,
                saveAs: false,
                conflictAction: 'overwrite'
            });

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error saving user file:', error);
        }
    }
} 