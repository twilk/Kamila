# Analiza i implementacja menu z tłumaczeniami

## 1. Analiza systemu i18n

### ✅ Zmodyfikowana implementacja
```javascript
// services/i18n.js - ZROBIONE
updateDataI18n() {
    // Najpierw menu - zapobiega migotaniu
    document.querySelectorAll('.link-title').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (key) {
            const translation = this.translate(key);
            if (translation) {
                const textElement = element.querySelector('.menu-text');
                if (textElement) {
                    textElement.textContent = translation;
                }
            }
        }
    });

    // Pozostałe elementy
    document.querySelectorAll('[data-i18n]:not(.link-title)').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = this.translate(key);
        if (translation) {
            element.textContent = translation;
        }
    });
}
```

## 2. Następne kroki implementacji

### 2.1. Aktualizacja HTML
```html
<!-- TODO: Zaktualizować strukturę menu -->
<div class="menu">
    <a class="link active" data-target="#chat" role="tab">
        <span class="link-icon">
            <i class="bi bi-chat-heart"></i>
        </span>
        <div class="link-title">
            <span class="menu-text" data-i18n="chat">Chat</span>
        </div>
    </a>
</div>
```

### 2.2. Style CSS do dodania
```css
/* TODO: Dodać style */
.menu-text {
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
    transition: opacity 0.2s ease-in;
}

.link-title {
    position: absolute;
    width: 85px;
    left: 45px;
    display: flex;
    align-items: center;
    height: 100%;
}
```

## 3. Lista zadań

### 3.1. System i18n [✅]
- [x] Modyfikacja metody updateDataI18n
- [x] Dodanie obsługi menu-text
- [x] Separacja menu od innych elementów
- [x] Optymalizacja kolejności aktualizacji

### 3.2. HTML [NASTĘPNE]
- [ ] Aktualizacja struktury menu w popup.html:
  ```html
  <div class="menu">
      <!-- Zaktualizować każdy element menu -->
  </div>
  ```
- [ ] Dodanie klas menu-text
- [ ] Przeniesienie data-i18n na właściwe elementy
- [ ] Weryfikacja tooltipów

### 3.3. CSS [PÓŹNIEJ]
- [ ] Dodanie nowych styli dla menu-text
- [ ] Optymalizacja animacji
- [ ] Dostosowanie szerokości i odstępów
- [ ] Style dla dark mode

### 3.4. Testy
- [ ] Test zmiany języka:
  ```javascript
  // TODO: Dodać test
  it('should update menu text without breaking icons', () => {
      // ...
  });
  ```
- [ ] Test zachowania ikon
- [ ] Test animacji
- [ ] Test tooltipów

## 4. Znane problemy do rozwiązania
1. [ ] Opóźnienie ładowania ikon Bootstrap
2. [ ] Kolejność inicjalizacji i18n vs DOM
3. [ ] Zachowanie tooltipów przy zmianie języka
4. [ ] Wydajność selektorów CSS

## 5. Optymalizacje
1. [ ] Cachowanie selektorów DOM
2. [ ] Lazy loading tłumaczeń
3. [ ] Redukcja reflow/repaint
4. [ ] Batch updates dla DOM

## 6. Następne kroki (w kolejności)
1. [ ] Aktualizacja popup.html
2. [ ] Dodanie nowych styli CSS
3. [ ] Testy jednostkowe
4. [ ] Code review
5. [ ] Dokumentacja zmian

## 7. Pytania do rozwiązania
1. Czy potrzebujemy osobną obsługę dla tooltipów menu?
2. Jak obsłużyć dynamiczne zmiany języka?
3. Czy warto dodać transition dla tekstu?
4. Jak zoptymalizować kolejność ładowania?

## 8. Metryki do sprawdzenia
- [ ] Czas pierwszego renderowania
- [ ] Czas zmiany języka
- [ ] Płynność animacji
- [ ] Zużycie pamięci

## 9. Dokumentacja
- [ ] Aktualizacja README
- [ ] JSDoc dla nowych metod
- [ ] Przykłady użycia
- [ ] Changelog