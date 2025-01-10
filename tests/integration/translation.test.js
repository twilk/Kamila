import { handleLanguageChange } from '../../services/languageManager.js';
import testRunner from '../../services/testRunner.js';

// Register translation tests
testRunner.registerTest('Language Change: Polish to English', async () => {
    // Setup basic DOM structure
    document.body.innerHTML = `
        <div class="test-panel mt-4">
            <h6 class="d-flex justify-content-between align-items-center">
                <span data-i18n="testPanel">Panel testów</span>
                <button id="run-all-tests" class="btn btn-sm btn-outline-primary">
                    <i class="bi bi-play-fill"></i>
                    <span data-i18n="runAllTests">Uruchom testy</span>
                </button>
            </h6>
        </div>
    `;

    // Initial state check - Polish
    const testPanelLabel = document.querySelector('[data-i18n="testPanel"]');
    const runTestsLabel = document.querySelector('[data-i18n="runAllTests"]');
    
    if (testPanelLabel.textContent !== 'Panel testów' || 
        runTestsLabel.textContent !== 'Uruchom testy') {
        throw new Error('Initial Polish labels not set correctly');
    }

    // Trigger language change to English
    await handleLanguageChange({ 
        target: { getAttribute: () => 'english' }
    });

    // Check if labels changed to English
    if (testPanelLabel.textContent !== 'Test Panel' || 
        runTestsLabel.textContent !== 'Run Tests') {
        throw new Error('Labels did not change to English correctly');
    }
});

testRunner.registerTest('Language Persistence Test', async () => {
    // Change to English
    await handleLanguageChange({ 
        target: { getAttribute: () => 'english' }
    });

    // Check localStorage
    if (localStorage.getItem('language') !== 'english') {
        throw new Error('Language preference not saved to localStorage');
    }

    // Reload page simulation
    document.body.innerHTML = `
        <div class="test-panel mt-4">
            <h6 class="d-flex justify-content-between align-items-center">
                <span data-i18n="testPanel"></span>
                <button id="run-all-tests" class="btn btn-sm btn-outline-primary">
                    <i class="bi bi-play-fill"></i>
                    <span data-i18n="runAllTests"></span>
                </button>
            </h6>
        </div>
    `;

    // Initialize with stored language
    const storedLang = localStorage.getItem('language');
    await handleLanguageChange({ 
        target: { getAttribute: () => storedLang }
    });

    // Check if labels are in English
    const testPanelLabel = document.querySelector('[data-i18n="testPanel"]');
    const runTestsLabel = document.querySelector('[data-i18n="runAllTests"]');
    
    if (testPanelLabel.textContent !== 'Test Panel' || 
        runTestsLabel.textContent !== 'Run Tests') {
        throw new Error('Labels not restored to English after reload');
    }
}); 