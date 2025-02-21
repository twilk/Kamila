import { languageManager } from '../../services/core/LanguageManager.js';
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

    // Initialize language manager
    await languageManager.initialize();

    // Initial state check - Polish
    const testPanelLabel = document.querySelector('[data-i18n="testPanel"]');
    const runTestsLabel = document.querySelector('[data-i18n="runAllTests"]');
    
    if (testPanelLabel.textContent !== languageManager.translate('testPanel') || 
        runTestsLabel.textContent !== languageManager.translate('runAllTests')) {
        throw new Error('Initial Polish labels not set correctly');
    }

    // Change language to English
    await languageManager.setLanguage('english');
    await languageManager.updateUI();

    // Check if labels changed to English
    if (testPanelLabel.textContent !== languageManager.translate('testPanel') || 
        runTestsLabel.textContent !== languageManager.translate('runAllTests')) {
        throw new Error('Labels did not change to English correctly');
    }
});

testRunner.registerTest('Language Persistence Test', async () => {
    // Initialize language manager
    await languageManager.initialize();

    // Change to English
    await languageManager.setLanguage('english');
    await languageManager.updateUI();

    // Check storage
    const storedLang = await chrome.storage.local.get('language');
    if (storedLang.language !== 'english') {
        throw new Error('Language preference not saved to storage');
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

    // Create new instance to test persistence
    const newManager = new LanguageManager();
    await newManager.initialize();
    await newManager.updateUI();

    // Check if labels are in English
    const testPanelLabel = document.querySelector('[data-i18n="testPanel"]');
    const runTestsLabel = document.querySelector('[data-i18n="runAllTests"]');
    
    if (testPanelLabel.textContent !== newManager.translate('testPanel') || 
        runTestsLabel.textContent !== newManager.translate('runAllTests')) {
        throw new Error('Labels not restored to English after reload');
    }
}); 