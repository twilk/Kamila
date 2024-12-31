export class TableSkeleton {
    constructor(tableId, options = {}) {
        this.tableId = tableId;
        this.options = {
            rows: options.rows || 10,
            columns: options.columns || 5,
            headerHeight: options.headerHeight || '40px',
            rowHeight: options.rowHeight || '32px',
            ...options
        };
    }

    show() {
        const table = document.getElementById(this.tableId);
        if (!table) return;

        // Zapisz oryginalną zawartość
        this.originalContent = table.innerHTML;
        
        // Stwórz szkielet
        const skeleton = this.createSkeleton();
        table.innerHTML = skeleton;
        
        // Dodaj klasę ładowania
        table.classList.add('loading');
    }

    hide() {
        const table = document.getElementById(this.tableId);
        if (!table || !this.originalContent) return;

        // Przywróć oryginalną zawartość
        table.innerHTML = this.originalContent;
        
        // Usuń klasę ładowania
        table.classList.remove('loading');
    }

    createSkeleton() {
        return `
            <table class="skeleton-table">
                <thead>
                    ${this.createHeader()}
                </thead>
                <tbody>
                    ${this.createRows()}
                </tbody>
            </table>
        `;
    }

    createHeader() {
        const cells = Array(this.options.columns)
            .fill('')
            .map(() => `
                <th style="height: ${this.options.headerHeight}">
                    <div class="skeleton-loader" style="height: 16px; width: 80%"></div>
                </th>
            `)
            .join('');

        return `<tr>${cells}</tr>`;
    }

    createRows() {
        return Array(this.options.rows)
            .fill('')
            .map(() => `
                <tr style="height: ${this.options.rowHeight}">
                    ${this.createRowCells()}
                </tr>
            `)
            .join('');
    }

    createRowCells() {
        return Array(this.options.columns)
            .fill('')
            .map((_, index) => {
                // Różne szerokości dla różnych kolumn
                const width = this.getColumnWidth(index);
                return `
                    <td>
                        <div class="skeleton-loader" style="height: 16px; width: ${width}%"></div>
                    </td>
                `;
            })
            .join('');
    }

    getColumnWidth(index) {
        // Dostosuj szerokości kolumn do rzeczywistego układu
        const widths = [80, 90, 60, 40, 40];
        return widths[index] || 70;
    }

    static init(tableId, options = {}) {
        return new TableSkeleton(tableId, options);
    }
}

// Eksportuj domyślną instancję dla tabeli rankingu
export const rankingSkeleton = new TableSkeleton('ranking-data', {
    rows: 10,
    columns: 5,
    headerHeight: '40px',
    rowHeight: '32px'
}); 