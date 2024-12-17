export class UserCardService {
    static async saveUserData(userData) {
        if (!userData || !userData.memberId || !userData.qrCodeUrl) return false;
        
        try {
            const data = await chrome.storage.local.get('darwin_users_data');
            let users = data.darwin_users_data || {};
            
            const existingUser = users[userData.memberId];
            const isNewQRCode = !existingUser || existingUser.qrCodeUrl !== userData.qrCodeUrl;
            
            users[userData.memberId] = {
                ...userData,
                lastLogin: new Date().toISOString(),
                notificationShown: existingUser?.notificationShown || false
            };

            await chrome.storage.local.set({
                'darwin_users_data': users,
                'darwin_current_user': userData.memberId
            });

            await this.saveUserFile(userData);

            return isNewQRCode;
        } catch (error) {
            console.error('Error saving user data:', error);
            return false;
        }
    }

    static async saveUserFile(data, filename) {
        try {
            if (typeof window === 'undefined' || !window.Blob) {
                throw new Error('Brak wsparcia dla Blob API');
            }

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            
            const url = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            window.URL.revokeObjectURL(url);
            
            return true;
        } catch (error) {
            console.error('Error saving user file:', error);
            return false;
        }
    }

    static async loadCurrentUser() {
        try {
            const data = await chrome.storage.local.get(['darwin_users_data', 'darwin_current_user']);
            const currentUserId = data.darwin_current_user;
            const users = data.darwin_users_data || {};
            
            return currentUserId ? users[currentUserId] : null;
        } catch (error) {
            console.error('Error loading current user data:', error);
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
            await chrome.storage.local.set({ 'darwin_current_user': userId });
        } catch (error) {
            console.error('Error setting current user:', error);
        }
    }

    static async markNotificationShown(userId) {
        try {
            const data = await chrome.storage.local.get('darwin_users_data');
            let users = data.darwin_users_data || {};
            
            if (users[userId]) {
                users[userId].notificationShown = true;
                await chrome.storage.local.set({ 'darwin_users_data': users });
            }
        } catch (error) {
            console.error('Error marking notification as shown:', error);
        }
    }
} 