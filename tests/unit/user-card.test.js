import { UserCard } from '../../components/user-card';
import { UserCardsService } from '../../services/user-cards.service';

jest.mock('../../services/user-cards.service');

describe('UserCard', () => {
    let container;
    let userCard;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        userCard = new UserCard(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
        jest.clearAllMocks();
    });

    test('should initialize with empty state', () => {
        expect(userCard.currentUser).toBeNull();
        expect(userCard.isFlipped).toBe(false);
    });

    test('should load current user on init', async () => {
        const mockUser = {
            memberId: '123',
            firstName: 'Jan',
            lastName: 'Kowalski'
        };

        UserCardsService.getCurrentUser.mockResolvedValueOnce('123');
        UserCardsService.getAllCards.mockResolvedValueOnce([mockUser]);

        await userCard.init();

        const nameElement = container.querySelector('.user-name');
        expect(nameElement.textContent).toBe('Jan Kowalski');
    });

    test('should toggle card flip', () => {
        userCard.currentUser = { memberId: '123' };
        userCard.toggleFlip();
        expect(userCard.isFlipped).toBe(true);
        expect(container.querySelector('.user-card-flip').classList.contains('flipped')).toBe(true);
    });

    test('should show loading state when generating QR', async () => {
        const mockUser = {
            memberId: '123',
            firstName: 'Jan',
            lastName: 'Kowalski'
        };

        // Symuluj długie generowanie QR
        UserCardsService.generateQRCode.mockImplementationOnce(() => 
            new Promise(resolve => setTimeout(() => 
                resolve('data:image/png;base64,test'), 100
            ))
        );

        const card = new UserCard(container);
        const updatePromise = card.updateCard(mockUser);

        // Sprawdź stan ładowania
        const loadingElement = container.querySelector('.qr-loading');
        expect(loadingElement).toBeTruthy();
        expect(card.isLoading).toBe(true);

        await updatePromise;

        // Sprawdź czy ładowanie się zakończyło
        expect(container.querySelector('.qr-loading')).toBeFalsy();
        expect(card.isLoading).toBe(false);
    });

    test('should handle QR generation errors', async () => {
        const mockUser = {
            memberId: '123',
            firstName: 'Jan',
            lastName: 'Kowalski'
        };

        UserCardsService.generateQRCode.mockRejectedValueOnce(
            new Error('Generation failed')
        );

        const card = new UserCard(container);
        await card.updateCard(mockUser);

        const errorElement = container.querySelector('.qr-error');
        expect(errorElement).toBeTruthy();
        expect(errorElement.textContent).toContain('Błąd podczas generowania');
    });
}); 