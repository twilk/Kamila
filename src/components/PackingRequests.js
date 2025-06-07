import { PackingManager } from '../../services/core/PackingManager.js';
import { EventManager } from '../../services/core/EventManager.js';
import { LanguageManager } from '../../services/core/LanguageManager.js';

export class PackingRequests {
    constructor() {
        this.state = {
            requests: [],
            loading: true,
            error: null,
            translations: {}
        };
        
        this.container = null;
        this.table = null;
        this.orders = [];
        
        // Initialize managers but don't use them until they're ready
        this.eventManager = null;
        this.languageManager = null;
        this.packingManager = null;
    }

    async mount(container) {
        try {
            this.container = container;
            
            // Initialize managers
            await this.initializeManagers();
            
            // Load translations and data
            await this.loadTranslations();
            await this.loadPackingRequests();
            
            // Setup event listeners
            if (this.eventManager) {
                this.eventManager.on('packing:confirmed', () => {
                    this.loadPackingRequests();
                });
            }
        } catch (error) {
            console.error('Failed to mount packing component:', error);
            this.setState({ error: error.message || 'Failed to initialize component' });
        }
    }

    async initializeManagers() {
        try {
            // Get manager instances
            this.eventManager = EventManager.getInstance();
            this.languageManager = LanguageManager.getInstance();
            this.packingManager = PackingManager.getInstance();

            // Wait for managers to be ready
            await Promise.all([
                this.waitForManager('eventManager', this.eventManager),
                this.waitForManager('languageManager', this.languageManager),
                this.waitForManager('packingManager', this.packingManager)
            ]);
        } catch (error) {
            console.error('Failed to initialize managers:', error);
            throw new Error(`Failed to initialize component: ${error.message}`);
        }
    }

    async waitForManager(name, manager) {
        if (!manager) {
            throw new Error(`${name} is not available`);
        }
        
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            if (manager.isInitialized?.()) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error(`${name} failed to initialize after ${maxAttempts} attempts`);
    }

    async loadTranslations() {
        try {
            // Wait for language manager to be ready
            if (!this.languageManager.isInitialized()) {
                await new Promise(resolve => setTimeout(resolve, 100));
                if (!this.languageManager.isInitialized()) {
                    throw new Error('LanguageManager not initialized');
                }
            }

            // Wait for translations to be loaded
            if (!this.languageManager.hasTranslations()) {
                await this.languageManager.waitForTranslations();
            }

            // Load all required translations
            this.state.translations = {
                loading: await this.languageManager.translate('packing.loading'),
                error: await this.languageManager.translate('packing.error'),
                retry: await this.languageManager.translate('packing.retry'),
                title: await this.languageManager.translate('packing.title'),
                table: {
                    orderId: await this.languageManager.translate('packing.table.orderId'),
                    store: await this.languageManager.translate('packing.table.store'),
                    products: await this.languageManager.translate('packing.table.products'),
                    shipping: await this.languageManager.translate('packing.table.shipping'),
                    status: await this.languageManager.translate('packing.table.status'),
                    actions: await this.languageManager.translate('packing.table.actions')
                },
                status: {
                    packed: await this.languageManager.translate('packing.status.packed'),
                    pending: await this.languageManager.translate('packing.status.pending')
                },
                shipping: {
                    yes: await this.languageManager.translate('packing.shipping.yes'),
                    no: await this.languageManager.translate('packing.shipping.no')
                },
                confirm: await this.languageManager.translate('packing.confirm'),
                confirmSuccess: await this.languageManager.translate('packing.confirmSuccess'),
                confirmError: await this.languageManager.translate('packing.confirmError')
            };

            // Subscribe to language changes
            this.eventManager.on('language:changed', () => this.loadTranslations());
        } catch (error) {
            console.error('Failed to load translations:', error);
            // Set fallback translations
            this.state.translations = {
                loading: 'Loading packing requests...',
                error: 'Error loading packing requests',
                retry: 'Retry',
                title: 'Packing Requests',
                table: {
                    orderId: 'Order ID',
                    store: 'Store',
                    products: 'Products',
                    shipping: 'Shipping',
                    status: 'Status',
                    actions: 'Actions'
                },
                status: {
                    packed: 'Packed',
                    pending: 'Pending'
                },
                shipping: {
                    yes: 'Yes',
                    no: 'No'
                },
                confirm: 'Confirm Packing',
                confirmSuccess: 'Packing confirmed for order {id}',
                confirmError: 'Failed to confirm packing'
            };
            // Emit error event
            this.eventManager.emit('error:occurred', {
                error,
                context: 'PackingRequests.loadTranslations'
            });
        } finally {
            this.render();
        }
    }

    async loadPackingRequests() {
        try {
            this.setState({ loading: true });
            const result = await this.packingManager.getPackingRequests();
            
            if (result.success) {
                this.setState({ requests: result.data, error: null });
            } else {
                throw new Error(result.error || this.state.translations.error || 'Failed to load packing requests');
            }
        } catch (error) {
            this.setState({ error: error.message });
            this.eventManager.emit('error:occurred', { 
                error, 
                context: 'PackingRequests' 
            });
        } finally {
            this.setState({ loading: false });
        }
    }

    async handlePackingConfirmed(order, checkbox) {
        try {
            checkbox.disabled = true;
            
            // Generate exchange file
            const fileData = await this.generateExchangeFile(order);
            
            // Upload to server
            const response = await fetch('https://darwina.pl/api/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(fileData)
            });

            if (!response.ok) {
                throw new Error('Failed to upload exchange file');
            }

            checkbox.disabled = false;
            checkbox.checked = true;
            checkbox.parentElement.classList.add('confirmed');
        } catch (error) {
            console.error('Error confirming packing:', error);
            checkbox.disabled = false;
            checkbox.checked = false;
            alert('Wystąpił błąd podczas generowania pliku wymiany');
        }
    }

    async generateExchangeFile(order) {
        const data = new Date();
        const formattedDate = data.toLocaleDateString('pl-PL');
        
        const filename = `RW_wydanie_${order.labelGroup}_${order.index}.txt`;
        
        const content = `TypPolskichLiter:LA TypDok:RW NrDok:RW_${order.labelGroup} Data:${formattedDate} Magazyn:${order.shopName} SposobPlatn:GOT TerminPlatn:0 IndeksCentralny:NIE NazwaWystawcy:Darwina.pl Retail Sp. z o.o AdresWystawcy:W•wozowa 6/4B, 02-796 Warszawa KodWystawcy:02-796 PocztaWystawcy: MiastoWystawcy:Warszawa UlicaWystawcy:W•wozowa 6/4B NrDomuWystawcy:6 NrLokaluWystawcy:4B NazwaUlicyWystawcy:W•wozowa GminaWystawcy:Warszawa PowiatWystawcy:Warszawa WojewodztwoWystawcy:mazowieckie KodKrajuWystawcy:PL NIPWystawcy:9512387656 BankWystawcy:mBank KontoWystawcy:50 1140 2004 0000 3102 7760 2647 TelefonWystawcy:+48 888 160 888 NrWystawcyWSieciSklepow:${order.shopId} WystawcaToCentralaSieci:0 NrWystawcyObcyWSieciSklepow: IloscLinii:${order.lines.length} ${order.lines.map(line => {
            const wartosc = (line.quantity * line.price).toFixed(2);
            const cenaSp = (line.quantity * line.price * 1.23).toFixed(2);
            return `Linia:Nazwa{${line.productName}}Kod{${line.ean}}Vat{23}Jm{szt}Asortyment{${line.category}}Sww{}PKWiU{}Ilosc{${line.quantity}}Cena{n${line.price}}Wartosc{n${wartosc}}IleWOpak{1}CenaSp{b${cenaSp}}TowId{${line.productId}}`;
        }).join('\n')} Stawka:Vat{23}SumaNet{${order.totalNet}}SumaVat{${order.totalVat}} DoZaplaty:${order.total}`;
        
        return { filename, content };
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.render();
    }

    createLoadingView() {
        const div = document.createElement('div');
        div.className = 'loading-state p-4';
        
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-spinner';
        div.appendChild(loadingDiv);
        
        const p = document.createElement('p');
        p.className = 'text-sm text-gray-600 mt-2';
        p.textContent = this.state.translations.loading || 'Loading packing requests...';
        div.appendChild(p);
        
        return div;
    }

    createErrorView() {
        const div = document.createElement('div');
        div.className = 'error-state p-4';
        
        const h3 = document.createElement('h3');
        h3.className = 'text-red-600';
        h3.textContent = this.state.translations.error || 'Error loading packing requests';
        div.appendChild(h3);
        
        const p = document.createElement('p');
        p.className = 'text-sm text-gray-600';
        p.textContent = this.state.error;
        div.appendChild(p);
        
        const button = document.createElement('button');
        button.className = 'mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600';
        button.textContent = this.state.translations.retry || 'Retry';
        button.onclick = () => this.loadPackingRequests();
        div.appendChild(button);
        
        return div;
    }

    createTableView() {
        const container = document.createElement('div');
        container.className = 'packing-requests';

        const title = document.createElement('h2');
        title.className = 'text-xl font-semibold mb-4';
        title.textContent = this.state.translations.title || 'Packing Requests';
        container.appendChild(title);

        this.table = this.createTable();
        container.appendChild(this.table);

        return container;
    }

    createTable() {
        const table = document.createElement('table');
        table.className = 'packing-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID zamówienia</th>
                    <th>Sklep</th>
                    <th>Produkty</th>
                    <th>Wysyłka</th>
                    <th>Spakowano</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        return table;
    }

    renderOrder(order) {
        const tr = document.createElement('tr');
        
        // ID zamówienia
        const tdId = document.createElement('td');
        tdId.textContent = order.id;
        
        // Sklep
        const tdShop = document.createElement('td');
        tdShop.textContent = order.shopName;
        
        // Lista produktów
        const tdProducts = document.createElement('td');
        tdProducts.textContent = order.lines.map(line => 
            `${line.productName} (x${line.quantity})`
        ).join(', ');
        
        // Informacja o wysyłce
        const tdShipping = document.createElement('td');
        tdShipping.textContent = order.isShipping ? 'Tak' : 'Nie';
        
        // Checkbox potwierdzenia
        const tdPacked = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.handlePackingConfirmed(order, checkbox);
            }
        });
        tdPacked.appendChild(checkbox);
        
        tr.append(tdId, tdShop, tdProducts, tdShipping, tdPacked);
        return tr;
    }

    render() {
        if (!this.container) return;
        
        // Clear current content
        this.container.innerHTML = '';
        
        let content;
        if (this.state.loading) {
            content = this.createLoadingView();
        } else if (this.state.error) {
            content = this.createErrorView();
        } else {
            content = this.createTableView();
        }
        
        this.container.appendChild(content);
    }

    unmount() {
        this.container = null;
    }

    async updateOrders() {
        try {
            const response = await fetch('https://darwina.pl/api/orders');
            if (!response.ok) {
                throw new Error('Failed to fetch orders');
            }
            
            this.orders = await response.json();
            this.render();
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
    }
}

// Add styles
const style = document.createElement('style');
style.textContent = `
    .packing-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
    }

    .packing-table th,
    .packing-table td {
        padding: 12px;
        text-align: left;
        border: 1px solid #ddd;
    }

    .packing-table th {
        background-color: #f5f5f5;
        font-weight: bold;
    }

    .packing-table tr:nth-child(even) {
        background-color: #f9f9f9;
    }

    .packing-table tr:hover {
        background-color: #f0f0f0;
    }

    .packing-table td.confirmed {
        background-color: #e8f5e9;
    }

    .packing-table input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
    }

    .packing-table input[type="checkbox"]:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }
`;
document.head.appendChild(style); 