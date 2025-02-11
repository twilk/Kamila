import { ACTIVE_USERS, getUserByMemberId, generateUserJson, saveUserFile } from './users.js';

export class UserCardService {
    static async saveUserData(userData) {
        if (!userData || !userData.memberId || !userData.qrCodeUrl) return false;
        
        try {
            const data = await chrome.storage.local.get('darwin_users_data');
            let users = data.darwin_users_data || {};
            
            const existingUser = users[userData.memberId];
            const isNewQRCode = !existingUser || existingUser.qrCodeUrl !== userData.qrCodeUrl;
            
            // Połącz z istniejącymi danymi
            const baseUserData = await getUserByMemberId(userData.memberId);
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
            await saveUserFile(mergedData);

            // Aktualizuj kartę użytkownika
            await UserCardService.updateUserCard(mergedData);

            return isNewQRCode;
        } catch (error) {
            console.error('Error saving user data:', error);
            return false;
        }
    }

    static async loadCurrentUser() {
        try {
            const data = await chrome.storage.local.get(['darwin_current_user', 'darwin_users_data']);
            const currentUserId = data.darwin_current_user;
            const users = data.darwin_users_data || {};
            
            if (currentUserId && users[currentUserId]) {
                const userData = users[currentUserId];
                await UserCardService.updateUserCard(userData);
                return userData;
            }

            if (currentUserId) {
                const userData = await getUserByMemberId(currentUserId);
                if (userData) {
                    await UserCardService.updateUserCard(userData);
                    return userData;
                }
            }

            await UserCardService.updateUserCard(null);
            return null;
        } catch (error) {
            console.error('Error loading current user:', error);
            await UserCardService.updateUserCard(null);
            return null;
        }
    }

    static async getAllUsers() {
        try {
            const data = await chrome.storage.local.get('darwin_users_data');
            return data.darwin_users_data || {};
        } catch (error) {
            console.error('Error loading users data:', error);
            return {};
        }
    }

    static async setCurrentUser(userId) {
        try {
            if (!userId) {
                await chrome.storage.local.remove('darwin_current_user');
                await UserCardService.updateUserCard(null);
                return true;
            }

            const userData = await getUserByMemberId(userId);
            if (!userData) {
                throw new Error(`Nie znaleziono użytkownika o ID: ${userId}`);
            }

            await chrome.storage.local.set({ 'darwin_current_user': userId });
            await UserCardService.updateUserCard(userData);
            return true;
        } catch (error) {
            console.error('Error setting current user:', error);
            return false;
        }
    }

    static async markNotificationShown(userId) {
        try {
            const data = await chrome.storage.local.get('darwin_users_data');
            const users = data.darwin_users_data || {};
            
            if (users[userId]) {
                users[userId].notificationShown = true;
                await chrome.storage.local.set({ 'darwin_users_data': users });
                await saveUserFile(users[userId]);
                
                // Jeśli to aktualny użytkownik, aktualizuj kartę
                const currentUser = await UserCardService.loadCurrentUser();
                if (currentUser && currentUser.memberId === userId) {
                    await UserCardService.updateUserCard(users[userId]);
                }
            }
        } catch (error) {
            console.error('Error marking notification as shown:', error);
        }
    }

    static async initializeUserSelector() {
        const userSelect = document.getElementById('user-select');
        if (!userSelect) return;

        try {
            // Pobierz aktualnie wybranego użytkownika
            const { darwin_current_user } = await chrome.storage.local.get('darwin_current_user');

            // Wyczyść obecne opcje
            userSelect.innerHTML = '<option value="">Wybierz użytkownika</option>';

            // Sortuj użytkowników alfabetycznie
            const sortedUsers = [...ACTIVE_USERS].sort((a, b) => 
                a.fullName.localeCompare(b.fullName)
            );

            // Dodaj posortowane opcje
            sortedUsers.forEach(user => {
                const option = document.createElement('option');
                option.value = user.memberId;
                option.textContent = user.fullName;
                if (darwin_current_user === user.memberId) {
                    option.selected = true;
                }
                userSelect.appendChild(option);
            });

            // Obsługa zmiany użytkownika
            userSelect.addEventListener('change', async (e) => {
                const selectedId = e.target.value;
                await UserCardService.setCurrentUser(selectedId);
            });

            // Załaduj i wyświetl aktualnego użytkownika
            await UserCardService.loadCurrentUser();

        } catch (error) {
            console.error('Error initializing user selector:', error);
        }
    }

    static async updateUserCard(userData = null) {
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
} 