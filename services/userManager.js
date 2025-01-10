import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';
import { i18n } from './i18n.js';

export class UserManager extends BaseManager {
    constructor(uiManager) {
        super();
        this.uiManager = uiManager;
        this.currentUser = null;
        this.userCache = new Map();
    }

    async initialize() {
        try {
            await super.initialize();
            await this.initializeUserSelector();
            await this.loadSavedUser();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    async initializeUserSelector() {
        try {
            const userSelect = document.getElementById('user-select');
            if (!userSelect) return;

            // Get current user
            const { selectedUserId } = await chrome.storage.local.get('selectedUserId');

            // Clear current options
            userSelect.innerHTML = `<option value="" data-i18n="noUserSelected">${i18n.translate('noUserSelected')}</option>`;

            // Available user IDs
            const userIds = [
                '2', '4', '5', '6', '7', '8', '9', '10', '11', '13', '14', '15', 
                '17', '18', '19', '23', '24', '25', '26', '27', '29', '31', '32', 
                '33', '34', '38', '39', '40', '42', '43', '47', '50', '55', '57', 
                '58', '60', '62', '65', '67', '69', '70', '71', '72', '73', '76', 
                '81', '82', '83', '84'
            ];

            // Load all users
            const users = await Promise.all(
                userIds.map(async (userId) => {
                    try {
                        const response = await fetch(chrome.runtime.getURL(`users/${userId}.json`));
                        if (response.ok) {
                            const userData = await response.json();
                            return { id: userId, ...userData };
                        }
                        return null;
                    } catch (error) {
                        this.handleError(error, ErrorType.STORAGE, ErrorSeverity.WARNING, {
                            method: 'initializeUserSelector',
                            userId
                        });
                        return null;
                    }
                })
            );

            // Sort users by name
            const validUsers = users.filter(user => user !== null)
                .sort((a, b) => a.fullName.localeCompare(b.fullName));

            // Add sorted options
            validUsers.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.fullName;
                if (selectedUserId === user.id) {
                    option.selected = true;
                }
                userSelect.appendChild(option);
                this.userCache.set(user.id, user);
            });

            // Add change handler
            userSelect.addEventListener('change', async (e) => {
                const selectedId = e.target.value;
                await this.selectUser(selectedId);
            });

        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initializeUserSelector'
            });
        }
    }

    async loadSavedUser() {
        try {
            const { selectedUserId } = await chrome.storage.local.get('selectedUserId');
            if (selectedUserId) {
                await this.selectUser(selectedUserId);
            }
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.WARNING, {
                method: 'loadSavedUser'
            });
        }
    }

    async selectUser(userId) {
        try {
            // Save selection
            await chrome.storage.local.set({ selectedUserId: userId });

            if (!userId) {
                this.currentUser = null;
                await this.updateUserCard(null);
                return;
            }

            // Get user data from cache or load it
            let userData = this.userCache.get(userId);
            if (!userData) {
                const response = await fetch(chrome.runtime.getURL(`users/${userId}.json`));
                if (response.ok) {
                    userData = await response.json();
                    userData.id = userId;
                    this.userCache.set(userId, userData);
                }
            }

            if (userData) {
                this.currentUser = userData;
                await this.updateUserCard(userData);

                // Notify content script
                chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, { 
                            type: 'REFRESH_USER_DATA',
                            userData
                        });
                    }
                });
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'selectUser',
                userId
            });
        }
    }

    async updateUserCard(userData = null) {
        try {
            const cardInner = document.querySelector('.user-card-inner');
            const nameElement = document.querySelector('.user-card-front .user-name');
            const qrElement = document.querySelector('.user-card-back .qr-code');

            if (!userData) {
                if (nameElement) {
                    nameElement.textContent = i18n.translate('noUserSelected');
                }
                if (qrElement) {
                    qrElement.src = chrome.runtime.getURL('assets/default-avatar.jpg');
                }
                if (cardInner) {
                    cardInner.classList.add('no-user');
                }
                return;
            }

            // Update card with user data
            if (nameElement) {
                nameElement.textContent = userData.fullName;
            }

            if (qrElement) {
                // Show loader
                const loaderWrapper = document.createElement('div');
                loaderWrapper.className = 'loader-wrapper';
                loaderWrapper.innerHTML = `
                    <div class="loader-circle"></div>
                    <div class="loader-circle"></div>
                    <div class="loader-circle"></div>
                    <div class="loader-shadow"></div>
                    <div class="loader-shadow"></div>
                    <div class="loader-shadow"></div>
                `;
                qrElement.parentElement.appendChild(loaderWrapper);

                // Load QR code
                const qrImage = new Image();
                qrImage.onload = () => {
                    qrElement.src = qrImage.src;
                    qrElement.style.maxWidth = 'none';
                    qrElement.style.width = '100%';
                    loaderWrapper.remove();
                };

                qrImage.onerror = () => {
                    this.handleError(new Error(`Failed to load QR code for user ${userData.id}`), 
                        ErrorType.UI, ErrorSeverity.WARNING, {
                            method: 'updateUserCard',
                            userId: userData.id
                        });
                    qrElement.src = chrome.runtime.getURL('assets/default-avatar.jpg');
                    loaderWrapper.remove();
                };

                qrImage.src = chrome.runtime.getURL(`qrcodes/${userData.id}.png`);
            }

            if (cardInner) {
                cardInner.classList.remove('no-user');
            }

            // Add flip animation handler
            const cardFlip = document.querySelector('.user-card-flip');
            if (cardFlip) {
                cardFlip.addEventListener('click', () => {
                    cardInner.style.transform = 
                        cardInner.style.transform === 'rotateY(180deg)' ? 
                        'rotateY(0)' : 'rotateY(180deg)';
                });
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'updateUserCard',
                userId: userData?.id
            });
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    dispose() {
        try {
            this.currentUser = null;
            this.userCache.clear();
            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 