/**
 * Language constants for the application
 */
export const LANGUAGES = {
    POLISH: 'polish',
    ENGLISH: 'english',
    UKRAINIAN: 'ukrainian'
};

export const DEFAULT_LANGUAGE = LANGUAGES.POLISH;

export const LANGUAGE_NAMES = {
    [LANGUAGES.POLISH]: 'Polski',
    [LANGUAGES.ENGLISH]: 'English',
    [LANGUAGES.UKRAINIAN]: 'Українська'
};

export const LANGUAGE_FLAGS = {
    [LANGUAGES.POLISH]: 'PL',
    [LANGUAGES.ENGLISH]: 'EN',
    [LANGUAGES.UKRAINIAN]: 'UA'
};

export const AVAILABLE_LANGUAGES = Object.values(LANGUAGES);

/**
 * Validates if the given language is supported
 * @param {string} language Language to validate
 * @returns {boolean} True if language is supported
 */
export function isValidLanguage(language) {
    return AVAILABLE_LANGUAGES.includes(language);
}

/**
 * Gets the display name for a language
 * @param {string} language Language code
 * @returns {string} Display name or language code if not found
 */
export function getLanguageDisplayName(language) {
    return LANGUAGE_NAMES[language] || language;
}

/**
 * Gets the flag code for a language
 * @param {string} language Language code
 * @returns {string} Flag code or language code if not found
 */
export function getLanguageFlag(language) {
    return LANGUAGE_FLAGS[language] || language;
} 