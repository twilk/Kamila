import { virtualList } from './VirtualList.js';
import { notification } from './Notification.js';
import { loadingService } from '../services/LoadingService.js';
import { logService } from '../services/LogService.js';

/**
 * Komponent do obsługi progresywnego ładowania danych
 */
export class ProgressiveLoader {
    constructor(options = {}) {
        this.pageSize = options.pageSize || 50;
        this.loadMoreThreshold = options.loadMoreThreshold || 0.8;
        this.loadingId = options.loadingId || 'progressive-loader';
        this.onLoadMore = options.onLoadMore || (() => Promise.resolve([]));
        this.onError = options.onError || ((error) => notification.error(error.message));
        this.hasMore = true;
        this.currentPage = 1;
        this.loading = false;
        this.items = [];
        this.initialized = false;
        this.options = this.initializeOptions(options);
        logService.info('ProgressiveLoader component constructed');
    }

    /**
     * Inicjalizuje loader w kontenerze
     * @param {HTMLElement} container Element kontenera
     * @param {Function} renderItem Funkcja renderująca element
     */
    async initialize(container, renderItem) {
        if (this.initialized) {
            return;
        }

        try {
            logService.info('Initializing ProgressiveLoader component...');
            this.container = container;
            
            // Inicjalizuj wirtualną listę
            await virtualList.initialize(container, [], {
                itemHeight: 40,
                bufferSize: 5,
                batchSize: this.pageSize,
                renderItem
            });

            // Dodaj obsługę przewijania
            this.container.addEventListener('scroll', this.handleScroll.bind(this));

            // Załaduj pierwsze elementy
            await this.loadMore();

            this.initialized = true;
            logService.info('ProgressiveLoader component initialized');
        } catch (error) {
            logService.error('Failed to initialize ProgressiveLoader component', error);
            throw error;
        }
    }

    /**
     * Obsługuje zdarzenie przewijania
     */
    handleScroll() {
        if (this.loading || !this.hasMore) return;

        const { scrollTop, scrollHeight, clientHeight } = this.container;
        const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

        if (scrollPercentage > this.loadMoreThreshold) {
            this.loadMore();
        }
    }

    /**
     * Ładuje kolejną porcję danych
     */
    async loadMore() {
        if (this.loading || !this.hasMore) return;

        try {
            logService.debug('Loading more items...');
            this.loading = true;
            await loadingService.startLoading(this.loadingId);

            // Pobierz nowe elementy
            const newItems = await this.onLoadMore({
                page: this.currentPage,
                pageSize: this.pageSize,
                offset: this.items.length
            });

            // Sprawdź czy są jeszcze elementy do załadowania
            this.hasMore = newItems.length === this.pageSize;

            if (newItems.length > 0) {
                // Dodaj nowe elementy do listy
                this.items = [...this.items, ...newItems];
                await virtualList.appendItems(newItems);
                this.currentPage++;
                logService.debug(`Loaded ${newItems.length} new items`);
            }

            // Pokaż informację jeśli nie ma więcej elementów
            if (!this.hasMore) {
                logService.info('All items loaded');
                notification.info('Załadowano wszystkie elementy');
            }

        } catch (error) {
            logService.error('Failed to load more items', error);
            this.onError(error);
        } finally {
            this.loading = false;
            await loadingService.stopLoading(this.loadingId);
        }
    }

    /**
     * Resetuje stan loadera
     */
    async reset() {
        try {
            logService.info('Resetting ProgressiveLoader...');
            this.items = [];
            this.currentPage = 1;
            this.hasMore = true;
            this.loading = false;
            await virtualList.clear();
            logService.info('ProgressiveLoader reset successfully');
        } catch (error) {
            logService.error('Failed to reset ProgressiveLoader', error);
            throw error;
        }
    }

    /**
     * Odświeża dane
     */
    async refresh() {
        try {
            logService.info('Refreshing ProgressiveLoader...');
            await this.reset();
            await this.loadMore();
            logService.info('ProgressiveLoader refreshed successfully');
        } catch (error) {
            logService.error('Failed to refresh ProgressiveLoader', error);
            throw error;
        }
    }

    /**
     * Niszczy instancję loadera
     */
    async destroy() {
        try {
            logService.info('Destroying ProgressiveLoader component...');
            this.container.removeEventListener('scroll', this.handleScroll);
            await virtualList.destroy();
            this.container = null;
            this.initialized = false;
            logService.info('ProgressiveLoader component destroyed');
        } catch (error) {
            logService.error('Failed to destroy ProgressiveLoader component', error);
            throw error;
        }
    }

    /**
     * Tworzy nową instancję z domyślnymi opcjami
     * @param {Object} options Opcje konfiguracyjne
     * @returns {ProgressiveLoader} Nowa instancja komponentu
     */
    static create(options = {}) {
        return new ProgressiveLoader(options);
    }
}

// Create and export singleton instance
const progressiveLoader = new ProgressiveLoader();
export { progressiveLoader }; 