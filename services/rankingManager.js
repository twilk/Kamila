import Chart from '../lib/chart.js';

export class RankingManager {
    constructor() {
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
            this.setupEventListeners();
            await this.fetchAllData();
            
            // Poczekaj na załadowanie zakładki ranking
            const rankingTab = document.querySelector('button[data-target="#ranking"]');
            if (rankingTab) {
                rankingTab.addEventListener('shown.bs.tab', () => {
                    console.log('Ranking tab shown, initializing charts...');
                    this.initializeCharts();
                    this.updateCharts();
                });
            }

            // Jeśli zakładka ranking jest aktywna, zainicjuj wykresy od razu
            const activeTab = document.querySelector('.nav-link.active');
            if (activeTab && activeTab.getAttribute('data-target') === '#ranking') {
                console.log('Ranking tab is active, initializing charts...');
                setTimeout(() => {
                    this.initializeCharts();
                    this.updateCharts();
                }, 100); // Małe opóźnienie, aby upewnić się, że DOM jest gotowy
            }
        } catch (error) {
            console.error('Error during initialization:', error);
        }
    }

    setupEventListeners() {
        // Sorting
        document.querySelectorAll('#ranking-data th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.handleSort(th.dataset.sort));
        });

        // Filtering
        document.getElementById('name-filter').addEventListener('input', (e) => {
            this.filters.name = e.target.value.toLowerCase();
            this.applyFilters();
        });

        document.getElementById('position-filter').addEventListener('change', (e) => {
            this.filters.position = e.target.value;
            this.applyFilters();
        });

        document.getElementById('trend-filter').addEventListener('change', (e) => {
            this.filters.trend = e.target.value;
            this.applyFilters();
        });

        document.getElementById('reset-filters').addEventListener('click', () => {
            this.resetFilters();
        });
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
            console.error('Error fetching all data:', error);
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
                    margin: this.parseNumber(row.c[columnMap.margin]?.v) / 100, // Konwersja na wartość dziesiętną
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
            console.error(`Error fetching data for ${month}:`, error);
            return [];
        }
    }

    calculateHistoricalTrends() {
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
            const positionTrend = this.calculateTrend(trends.map(t => t.position), true); // true dla pozycji (niższa = lepsza)

            return {
                ...person,
                salesTrend,
                rankingTrend,
                positionTrend,
                historicalTrends: trends
            };
        });
    }

    calculateTrend(values, inversed = false) {
        if (values.length < 2) return 'stable';
        
        const last = values[0];
        const prev = values[1];
        const change = last - prev;
        const percentChange = (change / Math.abs(prev)) * 100;

        if (Math.abs(percentChange) < 5) return 'stable';
        if (inversed) {
            return change < 0 ? 'up' : 'down';
        }
        return change > 0 ? 'up' : 'down';
    }

    parseNumber(value) {
        if (value === null || value === undefined || value === '') return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            // Usuń spacje i zamień przecinki na kropki
            const cleanValue = value.replace(/\s/g, '').replace(',', '.');
            return parseFloat(cleanValue) || 0;
        }
        return 0;
    }

    handleSort(column) {
        if (this.sortConfig.column === column) {
            this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortConfig.column = column;
            this.sortConfig.direction = 'asc';
        }

        this.updateTable();
    }

    applyFilters() {
        this.filteredData = this.data.filter(item => {
            const nameMatch = item.name.toLowerCase().includes(this.filters.name);
            const positionMatch = this.matchPosition(item.position, this.filters.position);
            const trendMatch = !this.filters.trend || item.trend === this.filters.trend;
            
            return nameMatch && positionMatch && trendMatch;
        });

        this.updateTable();
        this.updateSummary();
        this.updateCharts();
    }

    matchPosition(position, filter) {
        if (!filter) return true;
        position = parseInt(position);
        
        switch (filter) {
            case 'top10': return position <= 10;
            case '11-20': return position > 10 && position <= 20;
            case '21-50': return position > 20 && position <= 50;
            case '50+': return position > 50;
            default: return true;
        }
    }

    resetFilters() {
        this.filters = {
            name: '',
            position: '',
            trend: ''
        };

        // Reset form inputs
        document.getElementById('name-filter').value = '';
        document.getElementById('position-filter').value = '';
        document.getElementById('trend-filter').value = '';

        this.filteredData = [...this.data];
        this.updateTable();
        this.updateSummary();
        this.updateCharts();
    }

    updateTable() {
        const tbody = document.querySelector('#ranking-data tbody');
        if (!tbody) return;

        // Sort data
        const sortedData = [...this.filteredData].sort((a, b) => {
            const aVal = a[this.sortConfig.column];
            const bVal = b[this.sortConfig.column];
            const modifier = this.sortConfig.direction === 'asc' ? 1 : -1;

            if (typeof aVal === 'number') {
                return (aVal - bVal) * modifier;
            }
            return aVal.toString().localeCompare(bVal.toString()) * modifier;
        });

        // Update sort indicators
        document.querySelectorAll('#ranking-data th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.sort === this.sortConfig.column) {
                th.classList.add(`sort-${this.sortConfig.direction}`);
            }
        });

        // Render table
        tbody.innerHTML = sortedData.map(item => `
            <tr>
                <td>${item.position}</td>
                <td>${item.name}</td>
                <td>${item.totalRanking.toLocaleString(undefined, {maximumFractionDigits: 2})} pkt</td>
                <td>${item.leads}</td>
                <td>${item.sales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} zł</td>
                <td>${item.units.toFixed(2)}</td>
                <td>${(item.margin * 100).toFixed(2)}%</td>
                <td>
                    <div class="sku-stats">
                        ${item.skuNew > 0 ? `<span class="sku-new" title="Nowe SKU">${item.skuNew}</span>` : ''}
                        ${item.skuFix > 0 ? `<span class="sku-fix" title="Poprawki SKU">${item.skuFix}</span>` : ''}
                        ${item.skuDub > 0 ? `<span class="sku-dub" title="Duplikaty SKU">${item.skuDub}</span>` : ''}
                        ${item.skuKat > 0 ? `<span class="sku-kat" title="Katalogowanie SKU">${item.skuKat}</span>` : ''}
                        ${item.skuArt > 0 ? `<span class="sku-art" title="Artykuły SKU">${item.skuArt}</span>` : ''}
                    </div>
                </td>
                <td>${item.training || '-'}</td>
                <td>${item.employeeRating || '-'}</td>
                <td>${item.storeRating || '-'}</td>
                <td>
                    <div class="trend-stats">
                        <span class="trend trend-${item.salesTrend}" title="Trend sprzedaży">
                            ${this.getTrendIcon(item.salesTrend)}
                        </span>
                        <span class="trend trend-${item.rankingTrend}" title="Trend rankingu">
                            ${this.getTrendIcon(item.rankingTrend)}
                        </span>
                        <span class="trend trend-${item.positionTrend}" title="Trend pozycji">
                            ${this.getTrendIcon(item.positionTrend)}
                        </span>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    getTrendIcon(trend) {
        switch (trend) {
            case 'up': return '↑';
            case 'down': return '↓';
            default: return '→';
        }
    }

    updateSummary() {
        const totalSales = this.filteredData.reduce((sum, item) => sum + item.sales, 0);
        const avgMargin = this.filteredData.reduce((sum, item) => sum + item.margin, 0) / this.filteredData.length;
        const totalLeads = this.filteredData.reduce((sum, item) => sum + item.leads, 0);
        const avgUnits = this.filteredData.reduce((sum, item) => sum + item.units, 0) / this.filteredData.length;
        
        const topPerformer = this.filteredData.reduce((best, item) => 
            item.totalRanking > (best?.totalRanking || 0) ? item : best, null);
            
        const topSeller = this.filteredData.reduce((best, item) => 
            item.sales > (best?.sales || 0) ? item : best, null);

        const skuStats = this.filteredData.reduce((stats, item) => {
            stats.new += item.skuNew;
            stats.fix += item.skuFix;
            stats.dub += item.skuDub;
            stats.kat += item.skuKat;
            stats.art += item.skuArt;
            return stats;
        }, { new: 0, fix: 0, dub: 0, kat: 0, art: 0 });

        document.getElementById('total-sales').textContent = `${totalSales.toLocaleString()} zł`;
        document.getElementById('avg-margin').textContent = `${(avgMargin * 100).toFixed(1)}%`;
        document.getElementById('total-leads').textContent = totalLeads.toString();
        document.getElementById('avg-units').textContent = avgUnits.toFixed(2);
        document.getElementById('top-performer').textContent = topPerformer ? 
            `${topPerformer.name} (${topPerformer.totalRanking.toLocaleString()} pkt)` : '-';
        document.getElementById('top-seller').textContent = topSeller ? 
            `${topSeller.name} (${topSeller.sales.toLocaleString()} zł)` : '-';
        document.getElementById('sku-stats').innerHTML = `
            <span class="sku-new" title="Nowe SKU">${skuStats.new}</span>
            <span class="sku-fix" title="Poprawki SKU">${skuStats.fix}</span>
            <span class="sku-dub" title="Duplikaty SKU">${skuStats.dub}</span>
            <span class="sku-kat" title="Katalogowanie SKU">${skuStats.kat}</span>
            <span class="sku-art" title="Artykuły SKU">${skuStats.art}</span>
        `;
    }

    initializeCharts() {
        try {
            console.log('Initializing charts...');
            this.destroyCharts(); // Wyczyść istniejące wykresy
            
            // Performance Chart
            const performanceCanvas = document.getElementById('performance-chart');
            if (!performanceCanvas) {
                console.error('Performance chart canvas not found');
                return;
            }

            performanceCanvas.width = performanceCanvas.offsetWidth;
            performanceCanvas.height = performanceCanvas.offsetHeight;

            const ctx = performanceCanvas.getContext('2d');
            if (!ctx) {
                console.error('Failed to get 2D context for performance chart');
                return;
            }

            console.log('Creating performance chart...');
            this.charts.performance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Sprzedaż (zł)',
                        data: [],
                        backgroundColor: 'rgba(114, 47, 55, 0.5)',
                        borderColor: 'rgb(114, 47, 55)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return value.toLocaleString() + ' zł';
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });

            // Historical Trends Chart
            const historicalCanvas = document.getElementById('historical-chart');
            if (!historicalCanvas) {
                console.error('Historical chart canvas not found');
                return;
            }

            historicalCanvas.width = historicalCanvas.offsetWidth;
            historicalCanvas.height = historicalCanvas.offsetHeight;

            const ctx2 = historicalCanvas.getContext('2d');
            if (!ctx2) {
                console.error('Failed to get 2D context for historical chart');
                return;
            }

            console.log('Creating historical chart...');
            this.charts.historical = new Chart(ctx2, {
                type: 'line',
                data: {
                    labels: this.availableMonths.slice().reverse(),
                    datasets: []
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return value.toLocaleString() + ' zł';
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                boxWidth: 12,
                                font: {
                                    size: 10
                                }
                            }
                        }
                    }
                }
            });

            console.log('Charts initialized successfully');
            this.updateCharts(); // Od razu zaktualizuj dane na wykresach
        } catch (error) {
            console.error('Error initializing charts:', error);
        }
    }

    updateCharts() {
        try {
            console.log('Updating charts...');
            
            // Update Performance Chart
            if (this.charts.performance) {
                console.log('Updating performance chart...');
                const topPerformers = [...this.filteredData]
                    .sort((a, b) => b.sales - a.sales)
                    .slice(0, 5);

                console.log('Top performers:', topPerformers);

                this.charts.performance.data.labels = topPerformers.map(item => item.name);
                this.charts.performance.data.datasets[0].data = topPerformers.map(item => item.sales);
                this.charts.performance.update();
            } else {
                console.warn('Performance chart not initialized');
            }

            // Update Historical Chart
            if (this.charts.historical) {
                console.log('Updating historical chart...');
                const topPerformers = [...this.data]
                    .sort((a, b) => b.sales - a.sales)
                    .slice(0, 5);

                console.log('Historical top performers:', topPerformers);

                const colors = [
                    'rgb(255, 99, 132)',
                    'rgb(54, 162, 235)',
                    'rgb(255, 206, 86)',
                    'rgb(75, 192, 192)',
                    'rgb(153, 102, 255)'
                ];

                this.charts.historical.data.datasets = topPerformers.map((person, index) => {
                    const monthlyData = this.availableMonths.slice().reverse().map(month => {
                        const monthData = this.historicalData[month];
                        const personData = monthData.find(p => p.name === person.name);
                        return personData ? personData.sales : 0;
                    });

                    console.log(`Historical data for ${person.name}:`, monthlyData);

                    return {
                        label: person.name,
                        data: monthlyData,
                        borderColor: colors[index],
                        backgroundColor: colors[index].replace('rgb', 'rgba').replace(')', ', 0.1)'),
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 3
                    };
                });

                this.charts.historical.update();
            } else {
                console.warn('Historical chart not initialized');
            }

            console.log('Charts updated successfully');
        } catch (error) {
            console.error('Error updating charts:', error);
            try {
                console.log('Attempting to reinitialize charts...');
                this.destroyCharts();
                this.initializeCharts();
            } catch (reinitError) {
                console.error('Failed to reinitialize charts:', reinitError);
            }
        }
    }

    destroyCharts() {
        try {
            console.log('Destroying charts...');
            if (this.charts.performance) {
                this.charts.performance.destroy();
                console.log('Performance chart destroyed');
            }
            if (this.charts.historical) {
                this.charts.historical.destroy();
                console.log('Historical chart destroyed');
            }
        } catch (error) {
            console.error('Error destroying charts:', error);
        } finally {
            this.charts = {};
        }
    }
} 