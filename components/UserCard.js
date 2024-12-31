import { userCardService } from '../services/UserCardService.js';
import { logService } from '../services/LogService.js';

/**
 * Komponent karty użytkownika
 */
export class UserCard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.userData = null;
        this.initialized = false;
        logService.info('UserCard component constructed');
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            logService.info('Initializing UserCard component...');
            await this.loadUserData();
            this.initialized = true;
            logService.info('UserCard component initialized');
        } catch (error) {
            logService.error('Failed to initialize UserCard component', error);
            throw error;
        }
    }

    async loadUserData() {
        try {
            logService.info('Loading user data...');
            this.userData = await userCardService.getUserData();
            await this.render();
            logService.info('User data loaded successfully');
        } catch (error) {
            logService.error('Failed to load user data', error);
            this.showError('Failed to load user data');
        }
    }

    async render() {
        if (!this.userData) {
            this.showError('No user data available');
            return;
        }

        try {
            logService.info('Rendering user card...');
            const qrCode = await userCardService.generateQRCode();
            
            this.container.innerHTML = `
                <div class="user-card">
                    <div class="user-card__header">
                        <img src="${this.userData.avatar || 'assets/default-avatar.png'}" 
                             alt="User avatar" 
                             class="user-card__avatar" />
                        <h2 class="user-card__name">${this.userData.name}</h2>
                    </div>
                    <div class="user-card__body">
                        <div class="user-card__info">
                            <p><strong>Email:</strong> ${this.userData.email}</p>
                            <p><strong>Role:</strong> ${this.userData.role}</p>
                            <p><strong>Status:</strong> ${this.userData.status}</p>
                        </div>
                        <div class="user-card__qr">
                            <img src="${qrCode}" alt="QR Code" />
                        </div>
                    </div>
                    <div class="user-card__footer">
                        <button class="btn btn-primary" onclick="this.refresh()">
                            Refresh
                        </button>
                    </div>
                </div>
            `;
            
            logService.info('User card rendered successfully');
        } catch (error) {
            logService.error('Failed to render user card', error);
            this.showError('Failed to render user card');
        }
    }

    showError(message) {
        logService.error('Showing error message:', message);
        this.container.innerHTML = `
            <div class="alert alert-danger">
                ${message}
                <button class="btn btn-link" onclick="this.refresh()">
                    Try again
                </button>
            </div>
        `;
    }

    async refresh() {
        try {
            logService.info('Refreshing user card...');
            await userCardService.refreshUserCard();
            await this.loadUserData();
            logService.info('User card refreshed successfully');
        } catch (error) {
            logService.error('Failed to refresh user card', error);
            this.showError('Failed to refresh user card');
        }
    }
}

// Create and export singleton instance
const userCard = new UserCard('user-card-container');
export { userCard }; 