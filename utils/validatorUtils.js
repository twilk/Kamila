import { errorUtils } from './errorUtils.js';

export const validatorUtils = {
    /**
     * Sprawdza czy wartość jest zdefiniowana
     */
    isDefined(value) {
        return value !== undefined && value !== null;
    },

    /**
     * Sprawdza czy string jest niepusty
     */
    isNonEmptyString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    },

    /**
     * Sprawdza czy wartość jest liczbą
     */
    isNumber(value) {
        return typeof value === 'number' && !isNaN(value);
    },

    /**
     * Sprawdza czy wartość jest dodatnią liczbą
     */
    isPositiveNumber(value) {
        return this.isNumber(value) && value > 0;
    },

    /**
     * Sprawdza czy wartość jest tablicą
     */
    isArray(value) {
        return Array.isArray(value);
    },

    /**
     * Sprawdza czy wartość jest niepustą tablicą
     */
    isNonEmptyArray(value) {
        return this.isArray(value) && value.length > 0;
    },

    /**
     * Sprawdza czy wartość jest obiektem
     */
    isObject(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    },

    /**
     * Sprawdza czy wartość jest funkcją
     */
    isFunction(value) {
        return typeof value === 'function';
    },

    /**
     * Sprawdza czy wartość jest poprawnym URL
     */
    isValidUrl(value) {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Sprawdza czy wartość jest poprawnym adresem email
     */
    isValidEmail(value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    },

    /**
     * Waliduje obiekt według schematu
     */
    validateObject(object, schema) {
        const errors = [];

        for (const [key, rules] of Object.entries(schema)) {
            const value = object[key];

            if (rules.required && !this.isDefined(value)) {
                errors.push(errorUtils.createError(
                    `Field '${key}' is required`,
                    'VALIDATION_ERROR',
                    { field: key }
                ));
                continue;
            }

            if (!this.isDefined(value)) {
                continue;
            }

            if (rules.type && typeof value !== rules.type) {
                errors.push(errorUtils.createError(
                    `Field '${key}' must be of type ${rules.type}`,
                    'VALIDATION_ERROR',
                    { field: key, expectedType: rules.type }
                ));
            }

            if (rules.validate) {
                try {
                    rules.validate(value);
                } catch (error) {
                    errors.push(errorUtils.createError(
                        error.message,
                        'VALIDATION_ERROR',
                        { field: key }
                    ));
                }
            }
        }

        return errors;
    },

    /**
     * Sprawdza czy wszystkie wymagane pola są obecne
     */
    validateRequiredFields(object, requiredFields) {
        const errors = [];

        for (const field of requiredFields) {
            if (!this.isDefined(object[field])) {
                errors.push(errorUtils.createError(
                    `Field '${field}' is required`,
                    'VALIDATION_ERROR',
                    { field }
                ));
            }
        }

        return errors;
    }
}; 