/**
 * Komponent do obsługi wirtualnej listy z progresywnym ładowaniem
 */
export class VirtualList {
    constructor(options = {}) {
        this.container = null;
        this.items = [];
        this.visibleItems = new Map();
        this.itemHeight = options.itemHeight || 40;
        this.bufferSize = options.bufferSize || 10;
        this.batchSize = options.batchSize || 50;
        this.renderItem = options.renderItem || (item => item.toString());
        this.onScroll = this.onScroll.bind(this);
        this.scheduledUpdate = null;
        this.observer = null;
    }

    /**
     * Inicjalizuje listę w kontenerze
     * @param {HTMLElement} container Element kontenera
     * @param {Array} items Lista elementów
     */
    init(container, items = []) {
        this.container = container;
        this.items = items;

        // Ustaw style kontenera
        this.container.style.cssText = `
            position: relative;
            overflow-y: auto;
            height: 100%;
        `;

        // Stwórz kontener na elementy
        this.content = document.createElement('div');
        this.content.style.cssText = `
            position: relative;
            width: 100%;
            height: ${this.items.length * this.itemHeight}px;
        `;
        this.container.appendChild(this.content);

        // Dodaj obsługę przewijania
        this.container.addEventListener('scroll', this.onScroll, { passive: true });

        // Ustaw Intersection Observer do wykrywania widocznych elementów
        this.setupIntersectionObserver();

        // Wykonaj pierwsze renderowanie
        this.update();
    }

    /**
     * Konfiguruje Intersection Observer
     */
    setupIntersectionObserver() {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    const index = parseInt(entry.target.dataset.index);
                    if (entry.isIntersecting) {
                        if (!this.visibleItems.has(index)) {
                            this.renderItemAtIndex(index);
                        }
                    } else {
                        this.visibleItems.delete(index);
                        entry.target.remove();
                    }
                });
            },
            {
                root: this.container,
                rootMargin: `${this.bufferSize * this.itemHeight}px 0px`
            }
        );
    }

    /**
     * Obsługuje zdarzenie przewijania
     */
    onScroll() {
        if (this.scheduledUpdate) return;
        
        this.scheduledUpdate = requestAnimationFrame(() => {
            this.update();
            this.scheduledUpdate = null;
        });
    }

    /**
     * Aktualizuje widoczne elementy
     */
    update() {
        const scrollTop = this.container.scrollTop;
        const containerHeight = this.container.clientHeight;

        // Oblicz zakres widocznych elementów
        const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
        const endIndex = Math.min(
            this.items.length,
            Math.ceil((scrollTop + containerHeight) / this.itemHeight) + this.bufferSize
        );

        // Usuń elementy poza widokiem
        this.visibleItems.forEach((element, index) => {
            if (index < startIndex || index >= endIndex) {
                element.remove();
                this.visibleItems.delete(index);
            }
        });

        // Dodaj nowe elementy
        for (let i = startIndex; i < endIndex; i += this.batchSize) {
            const batchEnd = Math.min(i + this.batchSize, endIndex);
            this.renderBatch(i, batchEnd);
        }
    }

    /**
     * Renderuje partię elementów
     * @param {number} start Indeks początkowy
     * @param {number} end Indeks końcowy
     */
    async renderBatch(start, end) {
        const fragment = document.createDocumentFragment();
        
        for (let i = start; i < end; i++) {
            if (!this.visibleItems.has(i)) {
                const element = this.createItemElement(i);
                fragment.appendChild(element);
                this.visibleItems.set(i, element);
            }
        }

        this.content.appendChild(fragment);
    }

    /**
     * Renderuje element o danym indeksie
     * @param {number} index Indeks elementu
     */
    renderItemAtIndex(index) {
        const element = this.createItemElement(index);
        this.content.appendChild(element);
        this.visibleItems.set(index, element);
    }

    /**
     * Tworzy element dla danego indeksu
     * @param {number} index Indeks elementu
     * @returns {HTMLElement} Element DOM
     */
    createItemElement(index) {
        const element = document.createElement('div');
        element.className = 'virtual-list-item';
        element.dataset.index = index;
        element.style.cssText = `
            position: absolute;
            top: ${index * this.itemHeight}px;
            left: 0;
            width: 100%;
            height: ${this.itemHeight}px;
            transform: translateZ(0);
        `;
        element.innerHTML = this.renderItem(this.items[index], index);
        return element;
    }

    /**
     * Aktualizuje listę elementów
     * @param {Array} newItems Nowa lista elementów
     */
    setItems(newItems) {
        this.items = newItems;
        this.content.style.height = `${this.items.length * this.itemHeight}px`;
        this.visibleItems.clear();
        this.content.innerHTML = '';
        this.update();
    }

    /**
     * Dodaje nowe elementy na koniec listy
     * @param {Array} items Nowe elementy
     */
    appendItems(items) {
        const oldLength = this.items.length;
        this.items = [...this.items, ...items];
        this.content.style.height = `${this.items.length * this.itemHeight}px`;
        
        // Jeśli jesteśmy blisko końca, załaduj nowe elementy
        const scrollBottom = this.container.scrollTop + this.container.clientHeight;
        if (scrollBottom >= oldLength * this.itemHeight - this.container.clientHeight) {
            this.update();
        }
    }

    /**
     * Czyści listę
     */
    clear() {
        this.items = [];
        this.visibleItems.clear();
        this.content.innerHTML = '';
        this.content.style.height = '0px';
    }

    /**
     * Niszczy instancję listy
     */
    destroy() {
        this.container.removeEventListener('scroll', this.onScroll);
        this.observer?.disconnect();
        this.clear();
        this.container = null;
    }

    /**
     * Tworzy nową instancję z domyślnymi opcjami
     * @param {Object} options Opcje konfiguracyjne
     * @returns {VirtualList} Nowa instancja komponentu
     */
    static create(options = {}) {
        return new VirtualList(options);
    }
}

// Eksportuj domyślną instancję
export const virtualList = new VirtualList(); 