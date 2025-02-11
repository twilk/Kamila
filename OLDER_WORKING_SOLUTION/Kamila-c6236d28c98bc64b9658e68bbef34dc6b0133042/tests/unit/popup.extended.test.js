import { 
    handleThemeChange, 
    handleLanguageChange, 
    handleSendQuery, 
    handleLeadClick,
    updateLeadCounts,
    showLeadDetails,
    updateInterface,
    renderWallpapers
} from '@/popup';

describe('Extended Popup UI Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="response"></div>
            <div id="leadDetailsList"></div>
            <div id="count-submitted">0</div>
            <div id="count-confirmed">0</div>
            <div id="count-accepted">0</div>
            <div id="count-ready">0</div>
            <div id="wallpapers-grid"></div>
            <input type="text" id="query" value="test query">
            <div id="welcome-message"></div>
        `;
        
        // Mock Bootstrap
        global.bootstrap = {
            Modal: jest.fn().mockImplementation(() => ({
                show: jest.fn(),
                hide: jest.fn()
            }))
        };
    });

    test('should handle query submission', async () => {
        const mockResponse = { data: 'test response' };
        fetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse)
        }));

        await handleSendQuery();
        expect(document.getElementById('response').innerHTML).toContain('test response');
    });

    test('should handle empty query', async () => {
        document.getElementById('query').value = '';
        await handleSendQuery();
        expect(document.getElementById('response').innerHTML).toContain('errorEmptyQuery');
    });

    test('should update lead counts', async () => {
        const mockCounts = {
            submitted: 5,
            confirmed: 3,
            accepted: 2,
            ready: 1
        };

        const mockApi = {
            fetchLeadCounts: jest.fn().mockResolvedValue(mockCounts)
        };

        await updateLeadCounts(mockApi);
        
        expect(document.getElementById('count-submitted').textContent).toBe('5');
        expect(document.getElementById('count-confirmed').textContent).toBe('3');
        expect(document.getElementById('count-accepted').textContent).toBe('2');
        expect(document.getElementById('count-ready').textContent).toBe('1');
    });

    test('should show lead details modal', () => {
        const mockOrder = {
            id: 1,
            status: 'new',
            customer: {
                name: 'Test Customer',
                email: 'test@example.com'
            },
            items: [
                { name: 'Test Product', quantity: 1, price: 100 }
            ],
            total: 100,
            created_at: new Date().toISOString()
        };

        showLeadDetails([mockOrder]);
        
        const modalContent = document.getElementById('leadDetailsList').innerHTML;
        expect(modalContent).toContain('Test Customer');
        expect(modalContent).toContain('test@example.com');
        expect(modalContent).toContain('Test Product');
    });

    test('should render wallpapers', () => {
        const mockWallpapers = [
            { id: 'default', url: 'default.jpg', custom: false },
            { id: 'custom-1', url: 'custom1.jpg', custom: true }
        ];

        renderWallpapers(mockWallpapers, 'default');
        
        const grid = document.getElementById('wallpapers-grid');
        expect(grid.innerHTML).toContain('default.jpg');
        expect(grid.innerHTML).toContain('custom1.jpg');
        expect(grid.querySelector('.active')).toBeTruthy();
    });

    test('should update interface with translations', () => {
        const translations = {
            welcome: 'Welcome Test',
            queryPlaceholder: 'Test placeholder',
            leadStatuses: {
                submitted: 'Test Submitted',
                confirmed: 'Test Confirmed'
            }
        };

        updateInterface(translations);
        expect(document.getElementById('welcome-message').textContent).toBe('Welcome Test');
    });
}); 