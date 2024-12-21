import { performanceMonitor } from './performance.js';
import { accessibilityService } from './accessibility.js';
import { i18n } from './i18n.js';
import { QRWrapper } from '../lib/qr-wrapper.js';
import { NotificationService } from './notification.service.js';

export class UserCardsService {
    static STORAGE_KEY = 'user_cards';
    static CURRENT_USER_KEY = 'current_user';

    static async getAllCards() {
        performanceMonitor.startMeasure('get-user-cards');
        try {
            const result = await chrome.storage.local.get(this.STORAGE_KEY);
            performanceMonitor.endMeasure('get-user-cards');
            return result[this.STORAGE_KEY] || [];
        } catch (error) {
            performanceMonitor.endMeasure('get-user-cards');
            console.error('Error getting user cards:', error);
            return [];
        }
    }

    static async addCard(userData) {
        if (!userData.memberId) {
            throw new Error('Member ID is required');
        }

        const cards = await this.getAllCards();
        const existingCard = cards.find(card => card.memberId === userData.memberId);
        const isNew = !existingCard;

        if (existingCard) {
            // Update existing card
            Object.assign(existingCard, {
                ...userData,
                lastUpdated: Date.now()
            });
        } else {
            // Add new card
            cards.push({
                ...userData,
                created: Date.now(),
                lastUpdated: Date.now()
            });
        }

        await this.saveCards(cards);

        // Notify about new or updated card
        await NotificationService.notify({
            title: i18n.translate('notifications.userCard.title'),
            message: i18n.translate(isNew ? 'notifications.userCard.added' : 'notifications.userCard.updated', {
                name: `${userData.firstName} ${userData.lastName}`
            }),
            type: 'success'
        });

        return isNew;
    }

    static async getCurrentUser() {
        try {
            const result = await chrome.storage.local.get(this.CURRENT_USER_KEY);
            return result[this.CURRENT_USER_KEY];
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    }

    static async setCurrentUser(memberId) {
        try {
            await chrome.storage.local.set({ [this.CURRENT_USER_KEY]: memberId });
            return true;
        } catch (error) {
            console.error('Error setting current user:', error);
            return false;
        }
    }

    static async generateQRCode(userData) {
        try {
            const qrData = {
                memberId: userData.memberId,
                firstName: userData.firstName,
                lastName: userData.lastName,
                timestamp: Date.now()
            };

            const qrCode = await QRWrapper.generateAsync(JSON.stringify(qrData), {
                errorCorrectionLevel: 'H',
                cellSize: 8,
                margin: 2
            });

            if (qrCode) {
                await NotificationService.notify({
                    title: i18n.translate('notifications.userCard.title'),
                    message: i18n.translate('notifications.userCard.qrGenerated', {
                        name: userData.firstName
                    }),
                    type: 'success'
                });
            }

            return qrCode;
        } catch (error) {
            console.error('Error generating QR code:', error);
            
            await NotificationService.notify({
                title: i18n.translate('notifications.userCard.title'),
                message: i18n.translate('notifications.userCard.error'),
                type: 'error',
                data: { error }
            });
            
            return null;
        }
    }

    static async saveCards(cards) {
        try {
            await chrome.storage.local.set({ [this.STORAGE_KEY]: cards });
            return true;
        } catch (error) {
            console.error('Error saving user cards:', error);
            return false;
        }
    }
} 