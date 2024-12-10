import { 
    handleThemeChange,
    handleLanguageChange,
    handleLeadClick,
    updateLeadCounts,
    showLeadDetails,
    updateInterface,
    showError,
    showMessage
} from '@/popup';
import { darwinApi } from '@/services/darwinApi';

describe('UI Component Tests', () => {
    let mockBootstrapModal;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="response"></div>
            <div id="leadDetailsList"></div>
            <div class="lead-counts">
                <span id="count-submitted">0</span>
                <span id="count-confirmed">0</span>
                <span id="count-accepted">0</span>
                <span id="count-ready">0</span>
            </div>
            <div id="welcome-message"></div>
            <div class="lead-status" data-status="submitted">
                <span class="lead-count">5</span>
            </div>
        `;

        // Mock Bootstrap Modal
        mockBootstrapModal = {
            show: jest.fn(),
            hide: jest.fn()
        };
        global.bootstrap = {
            Modal: jest.fn(() => mockBootstrapModal)
        };

        // Mock localStorage
        localStorage.clear();
    });

    describe('Theme Handling', () => {
        test('should change theme and persist selection', () => {
            const event = {
                target: { value: 'dark' }
            };

            handleThemeChange(event);

            expect(document.body.classList.contains('dark-theme')).toBe(true);
            expect(localStorage.getItem('theme')).toBe('dark');

            // Test switching back to light theme
            event.target.value = 'light';
            handleThemeChange(event);

            expect(document.body.classList.contains('dark-theme')).toBe(false);
            expect(localStorage.getItem('theme')).toBe('light');
        });

        test('should handle invalid theme values', () => {
            const event = {
                target: { value: 'invalid-theme' }
            };

            handleThemeChange(event);

            // Should default to light theme
            expect(document.body.classList.contains('dark-theme')).toBe(false);
            expect(localStorage.getItem('theme')).toBe('light');
        });
    });

    describe('Lead Management', () => {
        test('should update lead counts correctly', async () => {
            const mockCounts = {
                submitted: 5,
                confirmed: 3,
                accepted: 2,
                ready: 1
            };

            jest.spyOn(darwinApi, 'fetchLeadCounts')
                .mockResolvedValue(mockCounts);

            await updateLeadCounts();

            Object.entries(mockCounts).forEach(([key, value]) => {
                expect(document.getElementById(`count-${key}`).textContent)
                    .toBe(value.toString());
            });
        });

        test('should show lead details in modal', async () => {
            const mockOrder = {
                id: 1,
                status: 'Złożone',
                customer: {
                    name: 'Test Customer',
                    email: 'test@example.com'
                },
                items: [
                    { name: 'Product 1', quantity: 2, price: 100 }
                ],
                total: 200,
                created_at: new Date().toISOString()
            };

            showLeadDetails([mockOrder]);

            const modalContent = document.getElementById('leadDetailsList').innerHTML;
            
            // Sprawdź czy wszystkie dane są wyświetlone
            expect(modalContent).toContain(mockOrder.customer.name);
            expect(modalContent).toContain(mockOrder.customer.email);
            expect(modalContent).toContain(mockOrder.items[0].name);
            expect(modalContent).toContain(mockOrder.total.toString());
            
            // Sprawdź czy modal został pokazany
            expect(mockBootstrapModal.show).toHaveBeenCalled();
        });

        test('should handle lead click events', async () => {
            const mockLeads = [
                { id: 1, status: 'new' }
            ];

            jest.spyOn(darwinApi, 'getLeadDetails')
                .mockResolvedValue(mockLeads);

            await handleLeadClick('submitted');

            expect(darwinApi.getLeadDetails).toHaveBeenCalledWith(
                expect.any(Number)
            );
            expect(mockBootstrapModal.show).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should display error messages correctly', () => {
            const errorMessage = 'Test error message';
            showError(errorMessage);

            const response = document.getElementById('response');
            expect(response.innerHTML).toContain('alert-danger');
            expect(response.innerHTML).toContain(errorMessage);
        });

        test('should display success messages correctly', () => {
            const successMessage = 'Operation successful';
            showMessage(successMessage);

            const response = document.getElementById('response');
            expect(response.innerHTML).toContain('alert-success');
            expect(response.innerHTML).toContain(successMessage);
        });

        test('should handle API errors in UI', async () => {
            jest.spyOn(darwinApi, 'fetchLeadCounts')
                .mockRejectedValue(new Error('API Error'));

            await updateLeadCounts();

            const response = document.getElementById('response');
            expect(response.innerHTML).toContain('alert-danger');
            expect(response.innerHTML).toContain('API Error');
        });
    });

    describe('Interface Updates', () => {
        test('should update interface with translations', () => {
            const translations = {
                welcome: 'Welcome Test',
                leadStatuses: {
                    submitted: 'New',
                    confirmed: 'Confirmed'
                }
            };

            updateInterface(translations);

            expect(document.getElementById('welcome-message').textContent)
                .toBe(translations.welcome);

            const leadStatus = document.querySelector('.lead-status');
            expect(leadStatus.getAttribute('title'))
                .toBe(translations.leadStatuses.submitted);
        });

        test('should handle missing translations', () => {
            const incompleteTranslations = {
                welcome: 'Welcome'
                // brak innych tłumaczeń
            };

            updateInterface(incompleteTranslations);

            // Powinno użyć fallbacków lub zachować istniejące teksty
            expect(document.getElementById('welcome-message').textContent)
                .toBe(incompleteTranslations.welcome);
        });
    });
}); 