#!/bin/bash

# Czyszczenie poprzedniego builda
rm -rf dist
mkdir dist

# Tworzenie struktury katalogów
mkdir -p dist/src/{config,services,locales}
mkdir -p dist/tests/{unit,integration}
mkdir -p dist/wallpapers

# Kopiowanie głównych plików
cp manifest.json dist/
cp credentials.json dist/
cp background.js dist/
cp version.json dist/
cp icon{16,48,128}.png dist/

# Kopiowanie plików źródłowych
cp src/config/api.js dist/src/config/
cp src/services/*.js dist/src/services/
cp popup.{html,js} dist/
cp style.css dist/
cp -r locales/ dist/locales/
cp -r wallpapers/ dist/wallpapers/

# Kopiowanie testów
cp -r tests/ dist/tests/

# Kopiowanie konfiguracji
cp package.json dist/
cp jest.config.js dist/

# Instalacja zależności
cd dist
npm install 