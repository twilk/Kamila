import { logService } from './LogService.js';

export class UIComponentService {
    constructor() {
        this.initialized = false;
        this.sortConfig = {
            column: null,
            direction: 'asc'
        };
        this.filterConfig = {
            text: '',
            showEmpty: true
        };
    }

    async initialize() {
        if (this.initialized) return;
        try {
            logService.info('Initializing UIComponentService...');
            this.initialized = true;
            logService.info('UIComponentService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize UIComponentService:', error);
            throw error;
        }
    }

    renderDRWNTable(data, container) {
        if (!container) {
            logService.warn('No container provided for DRWN table');
            return;
        }

        if (!data || !data.length) {
            container.innerHTML = `
                <div class="alert alert-info">
                    Brak danych DRWN dla wybranego sklepu.
                    <br>
                    <small>Sprawdź czy arkusz Google Sheets jest dostępny i zawiera dane.</small>
                </div>`;
                return;
        }

        // Add filter controls
        const filterHtml = `
            <div class="mb-3 d-flex justify-content-between align-items-center">
                <div class="d-flex gap-2 align-items-center">
                    <input type="text" 
                           class="form-control form-control-sm" 
                           id="drwn-filter" 
                           placeholder="Filtruj..." 
                           style="width: 200px;"
                           value="${this.filterConfig.text}">
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" 
                               type="checkbox" 
                               id="show-empty" 
                               ${this.filterConfig.showEmpty ? 'checked' : ''}>
                        <label class="form-check-label" for="show-empty">
                            Pokaż zerowe
                        </label>
                    </div>
                </div>
                <small class="text-muted">
                    Znaleziono: <span id="filtered-count">0</span> z ${data.length}
                </small>
            </div>
        `;

        // Filter data
        let filteredData = this.filterData(data);

        const headers = `
            <tr>
                <th class="sortable" data-sort="code">Kod</th>
                <th class="sortable" data-sort="name">Nazwa</th>
                <th class="sortable text-center" data-sort="stock">Stan</th>
                <th class="sortable text-center" data-sort="mag">MAG</th>
                <th class="sortable text-center" data-sort="drwn">MCZ</th>
                </tr>
        `;

        const rows = filteredData.map(item => {
            const status = this.getStatusClass(item.stock, item.mag, item.drwn);
            return `
                <tr class="${status.rowClass}">
                    <td class="text-monospace">${item.code || '-'}</td>
                    <td>${item.name || '-'}</td>
                    <td class="text-center font-weight-bold">${item.stock || '0'}</td>
                    <td class="text-center font-weight-bold">${item.mag || '0'}</td>
                    <td class="text-center font-weight-bold">${item.drwn || '0'}</td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            ${filterHtml}
            <div class="table-responsive">
                <table class="table table-sm table-hover">
                    <thead class="sticky-top bg-white">
                        ${headers}
            </thead>
            <tbody>
                        ${rows}
            </tbody>
                </table>
            </div>
        `;

        // Update filtered count
        const countElement = container.querySelector('#filtered-count');
        if (countElement) {
            countElement.textContent = filteredData.length;
        }

        // Add event listeners
        this.addTableEventListeners(container, data);
    }

    addTableEventListeners(container, data) {
        // Sorting
        container.querySelectorAll('.sortable').forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                const column = header.dataset.sort;
                if (this.sortConfig.column === column) {
                    this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                    this.sortConfig.column = column;
                    this.sortConfig.direction = 'asc';
                }
                this.renderDRWNTable(data, container);
            });

            // Add sort indicators
            if (header.dataset.sort === this.sortConfig.column) {
                header.innerHTML += this.sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
            }
        });

        // Filtering
        const filterInput = container.querySelector('#drwn-filter');
        if (filterInput) {
            filterInput.addEventListener('input', (e) => {
                this.filterConfig.text = e.target.value;
                this.renderDRWNTable(data, container);
            });
        }

        // Show empty checkbox
        const showEmptyCheckbox = container.querySelector('#show-empty');
        if (showEmptyCheckbox) {
            showEmptyCheckbox.addEventListener('change', (e) => {
                this.filterConfig.showEmpty = e.target.checked;
                this.renderDRWNTable(data, container);
            });
        }
    }

    filterData(data) {
        let filteredData = [...data];

        // Text filter
        if (this.filterConfig.text) {
            const searchText = this.filterConfig.text.toLowerCase();
            filteredData = filteredData.filter(item => 
                item.code.toLowerCase().includes(searchText) ||
                item.name.toLowerCase().includes(searchText)
            );
        }

        // Show empty filter
        if (!this.filterConfig.showEmpty) {
            filteredData = filteredData.filter(item => 
                item.stock > 0 || item.mag > 0 || item.drwn > 0
            );
        }

        // Sort data
        if (this.sortConfig.column) {
            filteredData.sort((a, b) => {
                let aVal = a[this.sortConfig.column];
                let bVal = b[this.sortConfig.column];

                // Handle string comparison
                if (typeof aVal === 'string') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }

                if (aVal < bVal) return this.sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return this.sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filteredData;
    }

    getStatusClass(stock, mag, mcz) {
        if (!stock && !mag && !mcz) {
            return {
                rowClass: 'table-secondary',
                badgeClass: 'bg-secondary',
                text: 'Brak danych'
            };
        }

        if (stock === 0 && mcz === 0) {
            return {
                rowClass: 'table-light',
                badgeClass: 'bg-secondary',
                text: 'Nieaktywny'
            };
        }

        if (stock === 0 && mcz > 0) {
            return {
                rowClass: 'table-danger',
                badgeClass: 'bg-danger',
                text: 'Brak towaru'
            };
        }

        if (stock < mcz) {
            return {
                rowClass: 'table-warning',
                badgeClass: 'bg-warning text-dark',
                text: 'Za mało'
            };
        }

        if (stock >= mcz * 2) {
            return {
                rowClass: 'table-info',
                badgeClass: 'bg-info text-dark',
                text: 'Nadmiar'
            };
        }

        return {
            rowClass: 'table-success',
            badgeClass: 'bg-success',
            text: 'OK'
        };
    }

    cleanup() {
        this.initialized = false;
        logService.debug('UIComponentService cleaned up');
    }
}

export const uiComponentService = new UIComponentService(); 