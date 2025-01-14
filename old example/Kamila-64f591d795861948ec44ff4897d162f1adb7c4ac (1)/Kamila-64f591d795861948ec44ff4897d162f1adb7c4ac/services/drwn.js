// Google Sheets API configuration
const SPREADSHEET_ID = '1K4pOUtkNXJML6-T7YKufvZM5GEOIY5NAfK-NeciYsTo';
const SHEETS_API_BASE = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq`;

export class DrwnService {
    static async fetchSheetData(sheetName) {
        try {
            const response = await fetch(`${SHEETS_API_BASE}?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            // Odpowiedź jest w formacie "google.visualization.Query.setResponse(...)"
            // Musimy wyciągnąć JSON z tego stringa
            const jsonStr = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/)[1];
            const data = JSON.parse(jsonStr);
            
            // Konwertujemy dane do naszego formatu
            const headers = data.table.cols.map(col => col.label);
            const rows = data.table.rows.map(row => row.c.map(cell => cell ? cell.v : ''));
            
            return {
                headers,
                rows
            };
        } catch (error) {
            console.error('Error fetching sheet data:', error);
            throw error;
        }
    }

    static async getSheetData(sheetName) {
        return await this.fetchSheetData(sheetName);
    }
} 