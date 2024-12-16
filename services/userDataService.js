class UserDataService {
    constructor() {
        this.cache = new Map();
    }

    async getUserByMemberId(memberId) {
        // Sprawdź cache
        if (this.cache.has(memberId)) {
            return this.cache.get(memberId);
        }

        try {
            const response = await fetch(chrome.runtime.getURL(`users/${memberId}.json`));
            if (!response.ok) {
                throw new Error(`User not found: ${memberId}`);
            }
            const userData = await response.json();
            
            // Zapisz w cache
            this.cache.set(memberId, userData);
            
            return userData;
        } catch (error) {
            console.error(`Error fetching user data: ${error.message}`);
            return null;
        }
    }

    clearCache() {
        this.cache.clear();
    }
}

export default new UserDataService(); 