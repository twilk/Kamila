import { UserCardsService } from '../../services/user-cards.service';

describe('UserCardsService', () => {
    beforeEach(() => {
        // Mock chrome.storage.local
        global.chrome = {
            storage: {
                local: {
                    get: jest.fn(),
                    set: jest.fn()
                }
            }
        };
    });

    test('should add new user card', async () => {
        const userData = {
            memberId: '123',
            firstName: 'Jan',
            lastName: 'Kowalski'
        };

        chrome.storage.local.get.mockResolvedValueOnce({ user_cards: [] });
        chrome.storage.local.set.mockResolvedValueOnce();

        const result = await UserCardsService.addCard(userData);
        expect(result).toBe(true); // New card added
        expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should update existing card', async () => {
        const existingCard = {
            memberId: '123',
            firstName: 'Jan',
            lastName: 'Kowalski',
            created: Date.now() - 1000
        };

        const updatedData = {
            memberId: '123',
            firstName: 'Jan',
            lastName: 'Nowak'
        };

        chrome.storage.local.get.mockResolvedValueOnce({ 
            user_cards: [existingCard] 
        });

        const result = await UserCardsService.addCard(updatedData);
        expect(result).toBe(false); // Card updated, not added
    });
}); 