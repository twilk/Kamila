import { DELIVERY_METHODS, DELIVERY_IDS } from './delivery.js';

export const stores = [
    { id: 'ALL', name: 'Wszystkie sklepy', deliveryId: null, drwn: null },
    { id: 'EKO', name: 'EKO', address: 'EkoPark Mokotów - Chodkiewicza 8', deliveryId: 61, drwn: 'EKO - Chodkiewicza 8' },
    { id: 'EVT', name: 'EVT', address: 'Event', deliveryId: 62, drwn: 'EVT - Event' },
    { id: 'FIL', name: 'FIL', address: 'Gocław - Fieldorfa 10', deliveryId: 62, drwn: 'FIL - Fieldorfa 10' },
    { id: 'FRA', name: 'FRA', address: 'Francuska - Zwycięzców 23', deliveryId: 63, drwn: 'FRA - Zwyciezców 23' },
    { id: 'GU', name: 'GU', address: 'Galeria Ursynów - Al. KEN 36', deliveryId: 60, drwn: 'GU - Aleja KEN 36' },
    { id: 'HOK', name: 'HOK', address: 'Ursus Szamoty - Herbu Oksza 6', deliveryId: 64, drwn: 'HOK - Herbu Oksza 6' },
    { id: 'HRU', name: 'HRU', address: 'Przy Muzeum Powstania - Hrubieszowska 2', deliveryId: 65, drwn: 'HRU - Hrubieszowska 2' },
    { id: 'IKR', name: 'IKR', address: 'Idzikowskiego - Ikara 20', deliveryId: 66, drwn: 'IKR - Ikara 20' },
    { id: 'KBT', name: 'KBT', address: 'Kabaty - Wąwozowa 6', deliveryId: 59, drwn: 'KBT - Wąwozowa 6_4B' },
    { id: 'LND', name: 'LND', address: 'C.H. Land - M. Służew - Wałbrzyska 11 lok 144b', deliveryId: 67, drwn: 'LND - Wałbrzyska 11' },
    { id: 'LUC', name: 'LUC', address: 'Przy Hiltonie - Łucka 20', deliveryId: 68, drwn: 'ŁUK - Łucka 20' },
    { id: 'MAG', name: 'MAG', address: 'MAG', deliveryId: 89, drwn: null },
    { id: 'MCZ', name: 'MCZ', address: 'Kabaty przy Bazarku - Wąwozowa 31', deliveryId: 58, drwn: 'MCZ - Wąwozowa 31' },
    { id: 'MOT', name: 'MOT', address: 'Praga Południe - Motorowa 10', deliveryId: 69, drwn: 'MOT - Motorowa 10' },
    { id: 'NOW', name: 'NOW', address: 'Przy Promenadzie - Nowaka-Jeziorańskiego 9', deliveryId: 70, drwn: 'NOW - Nowaka-Jeziorańskiego 9' },
    { id: 'OBR', name: 'OBR', address: 'Służewiec - Obrzeżna 7a', deliveryId: 71, drwn: 'OBR - Obrzeżna 7A_U1' },
    { id: 'PAN', name: 'PAN', address: 'Rondo ONZ - Pańska 73', deliveryId: 73, drwn: 'PAN - Pańska 73' },
    { id: 'PLO', name: 'PLO', address: 'Metro Płocka - Skierniewicka 34', deliveryId: 74, drwn: 'PLO - Skierniewicka 34' },
    { id: 'POW', name: 'POW', address: 'Artystyczny Żoliborz - Powązkowska 42', deliveryId: 75, drwn: 'POW - Powązkowska 42' },
    { id: 'RAC', name: 'RAC', address: 'Woronicza - Racjonalizacji 7', deliveryId: 76, drwn: 'RAC - Racjonalizacji 7' },
    { id: 'RAY', name: 'RAY', address: 'Bemowo Chrzanów - Rayskiego 11', deliveryId: 77, drwn: 'RAY - Rayskiego 11' },
    { id: 'RKW', name: 'RKW', address: 'Puławska - Rakowiecka 1/3', deliveryId: 78, drwn: 'RKW - Rakowiecka 1/3' },
    { id: 'RP', name: 'RP', address: 'Aleja Rzeczypospolitej 12', deliveryId: 79, drwn: 'RP - Rzeczypospolitej 12' },
    { id: 'SIK', name: 'SIK', address: 'Stegny - Sikorskiego 9b', deliveryId: 80, drwn: 'SIK - Sikorskiego 9B' },
    { id: 'STO', name: 'STO', address: 'Stokłosy - Al. KEN 95', deliveryId: 81, drwn: 'STO - Aleja KEN 95' },
    { id: 'WDK', name: 'WDK', address: 'Centrum - Widok 19', deliveryId: 82, drwn: 'WDK - Widok 19' },
    { id: 'WIL', name: 'WIL', address: 'Miasteczko Wilanów - Aleja Rzeczypospolitej 12', deliveryId: 83, drwn: 'WIL - Aleja Wilanowska 103' },
    { id: 'ŻEL', name: 'ŻEL', address: 'Wola - Żelazna 67', deliveryId: 84, drwn: 'ZEL - Zelazna 67' }
];

// Funkcja sprawdzająca czy wybrana metoda to odbiór osobisty
export const isPickupDelivery = (deliveryMethod) => {
    return deliveryMethod === DELIVERY_METHODS.PICKUP;
};

// Funkcja formatująca punkt odbioru
export const formatPickupPoint = (storeId) => {
    const store = stores.find(s => s.id === storeId);
    return store ? `Punkt odbioru: ${store.address}` : '';
};

// Funkcja przetwarzająca zamówienie
export const processOrder = (order) => {
    const store = stores.find(s => s.id === order.store_id);
    if (!store) return order;

    if (isPickupDelivery(order.delivery_method)) {
        // Dla odbioru osobistego używamy client_comment
        order.client_comment = formatPickupPoint(order.store_id);
        order.delivery_id = DELIVERY_IDS.PICKUP;
    } else {
        // Dla innych metod używamy deliveryId ze sklepu
        order.delivery_id = store.deliveryId;
        // Czyścimy client_comment jeśli był wcześniej ustawiony
        order.client_comment = '';
    }
    
    return order;
};

// Funkcja filtrująca sklepy dla wybranej metody dostawy
export const filterStoresByDeliveryMethod = (deliveryMethod) => {
    if (isPickupDelivery(deliveryMethod)) {
        // Dla odbioru osobistego zwracamy wszystkie sklepy oprócz ALL
        return stores.filter(store => store.id !== 'ALL');
    } else {
        // Dla innych metod zwracamy tylko sklepy z odpowiednim deliveryId
        return stores.filter(store => 
            store.id !== 'ALL' && 
            store.deliveryId && 
            store.deliveryId !== DELIVERY_IDS.PICKUP
        );
    }
};

// Funkcja sprawdzająca czy zamówienie ma poprawnie ustawiony sklep
export const validateOrderDelivery = (order) => {
    const store = stores.find(s => s.id === order.store_id);
    if (!store) return false;

    if (isPickupDelivery(order.delivery_method)) {
        return order.client_comment && order.delivery_id === DELIVERY_IDS.PICKUP;
    } else {
        return order.delivery_id === store.deliveryId;
    }
}; 