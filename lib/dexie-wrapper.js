/**
 * Wrapper dla biblioteki Dexie
 */

// Check if Dexie is available globally
if (typeof Dexie === 'undefined') {
    throw new Error('Dexie is not loaded. Make sure dexie.js is loaded before this module.');
}

// Export the global Dexie instance
export default Dexie;

// Export commonly used Dexie types and utilities
export const { liveQuery, Table, Collection, WhereClause } = Dexie; 