import { handleThemeChange, handleLanguageChange, showError, showResponse } from '@/popup';

describe('Popup UI', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="response"></div>
            <input type="radio" name="theme" value="dark">
            <span class="flag" data-lang="polish"></span>
        `;
    });

    test('should change theme', () => {
        const event = { target: { value: 'dark' } };
        handleThemeChange(event);
        
        expect(document.body.classList.contains('dark-theme')).toBe(true);
        expect(localStorage.getItem('theme')).toBe('dark');
    });

    test('should change language', async () => {
        const event = {
            target: document.querySelector('.flag'),
            getAttribute: () => 'polish'
        };

        await handleLanguageChange(event);
        expect(localStorage.getItem('language')).toBe('polish');
    });

    test('should show error message', () => {
        const errorMsg = 'Test error';
        showError(errorMsg);
        
        const response = document.getElementById('response');
        expect(response.innerHTML).toContain(errorMsg);
        expect(response.innerHTML).toContain('alert-danger');
    });

    test('should show API response', () => {
        const data = { test: 'value' };
        showResponse(data);
        
        const response = document.getElementById('response');
        expect(response.innerHTML).toContain('value');
    });
}); 