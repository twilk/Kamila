import Chart from '../lib/chart.js';
import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';

export class RankingManager extends BaseManager {
    constructor() {
        super();
        this.data = [];
        this.historicalData = {};
        this.filteredData = [];
        this.charts = {};
        this.sortConfig = {
            column: 'position',
            direction: 'asc'
        };
        this.filters = {
            name: '',
            position: '',
            trend: ''
        };
        this.currentMonth = '2024-12';
        this.availableMonths = ['2024-12', '2024-11', '2024-10', '2024-09', '2024-08'];
    }

    async initialize() {
        try {
            await super.initialize();
            this.setupEventListeners();
            await this.fetchAllData();
            
            // Poczekaj na załadowanie zakładki ranking
            const rankingTab = document.querySelector('button[data-target="#ranking"]');
            if (rankingTab) {
                rankingTab.addEventListener('shown.bs.tab', () => {
                    this.initializeCharts();
                    this.updateCharts();
                });
            }

            // Jeśli zakładka ranking jest aktywna, zainicjuj wykresy od razu
            const activeTab = document.querySelector('.nav-link.active');
            if (activeTab && activeTab.getAttribute('data-target') === '#ranking') {
                setTimeout(() => {
                    this.initializeCharts();
                    this.updateCharts();
                }, 100);
            }

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    setupEventListeners() {
        try {
        // Sorting
        document.querySelectorAll('#ranking-data th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.handleSort(th.dataset.sort));
        });

        // Filtering
            document.getElementById('name-filter')?.addEventListener('input', (e) => {
            this.filters.name = e.target.value.toLowerCase();
            this.applyFilters();
        });

            document.getElementById('position-filter')?.addEventListener('change', (e) => {
            this.filters.position = e.target.value;
            this.applyFilters();
        });

            document.getElementById('trend-filter')?.addEventListener('change', (e) => {
            this.filters.trend = e.target.value;
            this.applyFilters();
        });

            document.getElementById('reset-filters')?.addEventListener('click', () => {
            this.resetFilters();
        });

            // Refresh button
            document.getElementById('refresh-ranking')?.addEventListener('click', async () => {
                try {
                    const button = document.getElementById('refresh-ranking');
                    if (button) {
                        button.disabled = true;
                        button.classList.add('loading');
                    }
                    
                    await this.fetchAllData();
                    
                    if (button) {
                        button.disabled = false;
                        button.classList.remove('loading');
                    }
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                        method: 'refreshRanking'
                    });
                    const button = document.getElementById('refresh-ranking');
                    if (button) {
                        button.disabled = false;
                        button.classList.remove('loading');
                    }
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'setupEventListeners'
            });
        }
    }

    async fetchAllData() {
        try {
            // Pobierz dane z wszystkich miesięcy
            for (const month of this.availableMonths) {
                const monthData = await this.fetchMonthData(month);
                this.historicalData[month] = monthData;
            }

            // Ustaw bieżące dane na najnowszy miesiąc
            this.data = this.historicalData[this.currentMonth];
            this.filteredData = [...this.data];

            // Oblicz trendy na podstawie danych historycznych
            this.calculateHistoricalTrends();

            this.updateTable();
            this.updateSummary();
            this.updateCharts();
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.ERROR, {
                method: 'fetchAllData'
            });
            throw error;
        }
    }

    async fetchMonthData(month) {
        const SHEET_ID = '1gRAuqAbHrFR76Not6tjKLfvNz8FS_S2Uzo0GTQnMTWI';
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${month}&headers=1&range=A:R`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Accept': 'text/plain',
                },
                credentials: 'omit'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            const jsonText = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
            if (!jsonText || !jsonText[1]) {
                throw new Error('Invalid response format from Google Sheets');
            }
            
            const jsonData = JSON.parse(jsonText[1]);
            if (!jsonData.table || !jsonData.table.rows) {
                throw new Error('Invalid data structure received from Google Sheets');
            }

            // Mapowanie kolumn w zależności od miesiąca
            let columnMap;
            switch (month) {
                case '2024-08':
                    columnMap = {
                        position: 1,
                        name: 2,
                        totalRanking: 3,
                        leads: 4,
                        sales: 5,
                        units: 6,
                        margin: 7,
                        skuNew: 8,
                        skuFix: 9,
                        skuDub: 10,
                        skuKat: 11,
                        skuArt: 12,
                        training: 13,
                        employeeRating: 14,
                        storeRating: 15,
                        groupOrders: 16,
                        delay: 17
                    };
                    break;
                case '2024-09':
                case '2024-10':
                    columnMap = {
                        position: 1,
                        name: 2,
                        manager: 3,
                        totalRanking: 4,
                        leads: 5,
                        sales: 6,
                        units: 7,
                        margin: 8,
                        skuNew: 9,
                        skuFix: 10,
                        skuDub: 11,
                        skuKat: 12,
                        skuArt: 13,
                        training: 14,
                        employeeRating: 15,
                        storeRating: 16,
                        groupOrders: 17,
                        delay: 18
                    };
                    break;
                case '2024-11':
                case '2024-12':
                    columnMap = {
                        position: 0,
                        name: 1,
                        totalRanking: 2,
                        leads: 3,
                        sales: 4,
                        units: 5,
                        margin: 6,
                        skuNew: 7,
                        skuFix: 8,
                        skuDub: 9,
                        skuKat: 10,
                        skuArt: 11,
                        training: 12,
                        employeeRating: 13,
                        storeRating: 14,
                        groupOrders: 15,
                        delay: 16
                    };
                    break;
                default:
                    throw new Error(`Unknown month format: ${month}`);
            }

            return jsonData.table.rows
                .filter(row => row.c && row.c[columnMap.position] && row.c[columnMap.name])
                .map(row => ({
                    position: row.c[columnMap.position]?.v || '',
                    name: row.c[columnMap.name]?.v || '',
                    manager: columnMap.manager ? (row.c[columnMap.manager]?.v || '') : '',
                    totalRanking: this.parseNumber(row.c[columnMap.totalRanking]?.v),
                    leads: this.parseNumber(row.c[columnMap.leads]?.v),
                    sales: this.parseNumber(row.c[columnMap.sales]?.v),
                    units: this.parseNumber(row.c[columnMap.units]?.v),
                    margin: this.parseNumber(row.c[columnMap.margin]?.v) / 100,
                    skuNew: this.parseNumber(row.c[columnMap.skuNew]?.v),
                    skuFix: this.parseNumber(row.c[columnMap.skuFix]?.v),
                    skuDub: this.parseNumber(row.c[columnMap.skuDub]?.v),
                    skuKat: this.parseNumber(row.c[columnMap.skuKat]?.v),
                    skuArt: this.parseNumber(row.c[columnMap.skuArt]?.v),
                    training: row.c[columnMap.training]?.v || '',
                    employeeRating: row.c[columnMap.employeeRating]?.v || '',
                    storeRating: row.c[columnMap.storeRating]?.v || '',
                    groupOrders: this.parseNumber(row.c[columnMap.groupOrders]?.v),
                    delay: this.parseNumber(row.c[columnMap.delay]?.v)
                }))
                .filter(item => item.position && item.name);
        } catch (error) {
            this.handleError(error, ErrorType.NETWORK, ErrorSeverity.ERROR, {
                method: 'fetchMonthData',
                month
            });
            return [];
        }
    }

    parseNumber(value) {
        if (value === null || value === undefined || value === '') {
            return 0;
        }
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    }

    calculateHistoricalTrends() {
        try {
        // Dla każdej osoby oblicz trendy
        this.data = this.data.map(person => {
            const trends = this.availableMonths.map(month => {
                const monthData = this.historicalData[month];
                const personData = monthData.find(p => p.name === person.name);
                return personData ? {
                    sales: personData.sales,
                    ranking: personData.totalRanking,
                    position: personData.position
                } : null;
            }).filter(t => t !== null);

            // Oblicz trendy
            const salesTrend = this.calculateTrend(trends.map(t => t.sales));
            const rankingTrend = this.calculateTrend(trends.map(t => t.ranking));
                const positionTrend = this.calculateTrend(trends.map(t => t.position), true);

            return {
                ...person,
                salesTrend,
                rankingTrend,
                    positionTrend
            };
        });
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.WARNING, {
                method: 'calculateHistoricalTrends'
            });
        }
    }

    calculateTrend(values, reverse = false) {
        try {
            if (!values || values.length < 2) return 0;

            const n = values.length;
            let sumX = 0;
            let sumY = 0;
            let sumXY = 0;
            let sumXX = 0;

            for (let i = 0; i < n; i++) {
                const x = i;
                const y = values[i];
                sumX += x;
                sumY += y;
                sumXY += x * y;
                sumXX += x * x;
            }

            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            return reverse ? -slope : slope;
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.WARNING, {
                method: 'calculateTrend',
                values,
                reverse
            });
            return 0;
        }
    }

    handleSort(column) {
        try {
        if (this.sortConfig.column === column) {
            this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortConfig.column = column;
            this.sortConfig.direction = 'asc';
        }

        this.updateTable();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'handleSort',
                column
            });
        }
    }

    applyFilters() {
        try {
        this.filteredData = this.data.filter(item => {
            const nameMatch = item.name.toLowerCase().includes(this.filters.name);
                const positionMatch = !this.filters.position || item.position === this.filters.position;
                
                let trendMatch = true;
                if (this.filters.trend) {
                    const trendValue = item[`${this.filters.trend}Trend`];
                    trendMatch = trendValue > 0;
                }
            
            return nameMatch && positionMatch && trendMatch;
        });

        this.updateTable();
        this.updateCharts();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'applyFilters',
                filters: this.filters
            });
        }
    }

    resetFilters() {
        try {
        this.filters = {
            name: '',
            position: '',
            trend: ''
        };

            // Reset input values
        document.getElementById('name-filter').value = '';
        document.getElementById('position-filter').value = '';
        document.getElementById('trend-filter').value = '';

        this.filteredData = [...this.data];
        this.updateTable();
        this.updateCharts();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'resetFilters'
            });
        }
    }

    updateTable() {
        try {
        const tbody = document.querySelector('#ranking-data tbody');
        if (!tbody) return;

        // Sort data
        const sortedData = [...this.filteredData].sort((a, b) => {
                const aValue = a[this.sortConfig.column];
                const bValue = b[this.sortConfig.column];
                const direction = this.sortConfig.direction === 'asc' ? 1 : -1;
                
                if (typeof aValue === 'string') {
                    return direction * aValue.localeCompare(bValue);
                }
                return direction * (aValue - bValue);
            });

            // Update table
        tbody.innerHTML = sortedData.map(item => `
            <tr>
                <td>${item.position}</td>
                <td>${item.name}</td>
                    <td>${item.totalRanking.toFixed(2)}</td>
                <td>${item.leads}</td>
                    <td>${item.sales}</td>
                    <td>${item.units}</td>
                <td>${(item.margin * 100).toFixed(2)}%</td>
                    <td>${item.skuNew}</td>
                    <td>${item.skuFix}</td>
                    <td>${item.skuDub}</td>
                    <td>${item.skuKat}</td>
                    <td>${item.skuArt}</td>
                    <td>${item.training}</td>
                    <td>${item.employeeRating}</td>
                    <td>${item.storeRating}</td>
                    <td>${item.groupOrders}</td>
                    <td>${item.delay}</td>
                    <td>
                        <span class="trend ${item.salesTrend > 0 ? 'up' : 'down'}">
                            ${item.salesTrend.toFixed(2)}
                        </span>
                    </td>
                    <td>
                        <span class="trend ${item.rankingTrend > 0 ? 'up' : 'down'}">
                            ${item.rankingTrend.toFixed(2)}
                        </span>
                    </td>
                    <td>
                        <span class="trend ${item.positionTrend > 0 ? 'up' : 'down'}">
                            ${item.positionTrend.toFixed(2)}
                        </span>
                </td>
            </tr>
        `).join('');

            // Update sort indicators
            document.querySelectorAll('#ranking-data th[data-sort]').forEach(th => {
                th.classList.remove('sort-asc', 'sort-desc');
                if (th.dataset.sort === this.sortConfig.column) {
                    th.classList.add(`sort-${this.sortConfig.direction}`);
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'updateTable'
            });
        }
    }

    updateSummary() {
        try {
            const summary = {
                totalLeads: 0,
                totalSales: 0,
                totalUnits: 0,
                averageMargin: 0,
                totalSkuNew: 0,
                totalSkuFix: 0,
                totalSkuDub: 0,
                totalSkuKat: 0,
                totalSkuArt: 0,
                totalGroupOrders: 0,
                totalDelay: 0
            };

            this.filteredData.forEach(item => {
                summary.totalLeads += item.leads;
                summary.totalSales += item.sales;
                summary.totalUnits += item.units;
                summary.averageMargin += item.margin;
                summary.totalSkuNew += item.skuNew;
                summary.totalSkuFix += item.skuFix;
                summary.totalSkuDub += item.skuDub;
                summary.totalSkuKat += item.skuKat;
                summary.totalSkuArt += item.skuArt;
                summary.totalGroupOrders += item.groupOrders;
                summary.totalDelay += item.delay;
            });

            summary.averageMargin = summary.averageMargin / this.filteredData.length;

            // Update summary elements
            Object.entries(summary).forEach(([key, value]) => {
                const element = document.getElementById(`summary-${key}`);
                if (element) {
                    element.textContent = key === 'averageMargin' 
                        ? `${(value * 100).toFixed(2)}%` 
                        : value.toString();
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateSummary'
            });
        }
    }

    initializeCharts() {
        try {
            // Destroy existing charts
            Object.values(this.charts).forEach(chart => chart.destroy());
            this.charts = {};

            // Initialize new charts
            const chartConfigs = {
                salesChart: {
                    type: 'line',
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Sprzedaż w czasie'
                            }
                        }
                    }
                },
                rankingChart: {
                    type: 'line',
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                            title: {
                                display: true,
                                text: 'Ranking w czasie'
                            }
                        }
                    }
                }
            };

            Object.entries(chartConfigs).forEach(([chartId, config]) => {
                const canvas = document.getElementById(chartId);
                if (canvas) {
                    this.charts[chartId] = new Chart(canvas, {
                        type: config.type,
                        data: {
                            labels: [],
                            datasets: []
                        },
                        options: config.options
                    });
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initializeCharts'
            });
        }
    }

    updateCharts() {
        try {
            if (!this.charts.salesChart || !this.charts.rankingChart) return;

                const colors = [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                '#FF9F40', '#FF6384', '#C9CBCF', '#7BC225', '#FF85AD'
            ];

            const datasets = this.filteredData.slice(0, 10).map((person, index) => {
                const color = colors[index % colors.length];
                const monthlyData = this.availableMonths.map(month => {
                        const monthData = this.historicalData[month];
                        const personData = monthData.find(p => p.name === person.name);
                    return personData || null;
                }).filter(data => data !== null);

                    return {
                    sales: {
                        label: person.name,
                        data: monthlyData.map(data => data.sales),
                        borderColor: color,
                        backgroundColor: color + '20',
                        tension: 0.4
                    },
                    ranking: {
                        label: person.name,
                        data: monthlyData.map(data => data.totalRanking),
                        borderColor: color,
                        backgroundColor: color + '20',
                        tension: 0.4
                    }
                    };
                });

            // Update sales chart
            this.charts.salesChart.data = {
                labels: this.availableMonths,
                datasets: datasets.map(d => d.sales)
            };
            this.charts.salesChart.update();

            // Update ranking chart
            this.charts.rankingChart.data = {
                labels: this.availableMonths,
                datasets: datasets.map(d => d.ranking)
            };
            this.charts.rankingChart.update();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateCharts'
            });
        }
    }

    dispose() {
        try {
            // Destroy charts
            Object.values(this.charts).forEach(chart => chart.destroy());
            this.charts = {};

            // Clear data
            this.data = [];
            this.historicalData = {};
            this.filteredData = [];

            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 