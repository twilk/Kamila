/**
 * Language constants and validation
 */

export const LANGUAGES = {
    POLISH: 'polish',
    ENGLISH: 'english',
    UKRAINIAN: 'ukrainian'
};

export const LANGUAGE_CODES = {
    [LANGUAGES.POLISH]: 'polish',
    [LANGUAGES.ENGLISH]: 'english',
    [LANGUAGES.UKRAINIAN]: 'ukrainian'
};

export const LANGUAGE_NAMES = {
    [LANGUAGES.POLISH]: 'Polski',
    [LANGUAGES.ENGLISH]: 'English',
    [LANGUAGES.UKRAINIAN]: 'Українська'
};

export const DEFAULT_LANGUAGE = LANGUAGES.POLISH;

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
 * Gets the ISO code for a language
 * @param {string} language Language name
 * @returns {string} ISO code or language name if not found
 */
export function getLanguageCode(language) {
    return LANGUAGE_CODES[language] || language;
} 