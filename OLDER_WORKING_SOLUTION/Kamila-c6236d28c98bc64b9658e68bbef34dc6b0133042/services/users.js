import { getFromCache, saveToCache } from './cache';

// Lista aktywnych pracowników z ich ID
const ACTIVE_USERS = [
    { fullName: "Jurij Martiuk", memberId: "84", isManager: false },
    { fullName: "Patryk Danielik", memberId: "83", isManager: false },
    { fullName: "Mikita Shtyhel", memberId: "82", isManager: false },
    { fullName: "Katarzyna Kubiak", memberId: "81", isManager: false },
    { fullName: "Viacheslav Telianykov", memberId: "76", isManager: false },
    { fullName: "Bogdan Berezenko", memberId: "73", isManager: false },
    { fullName: "Agnieszka Glazer", memberId: "19", isManager: false },
    { fullName: "Agnieszka Szumska", memberId: "62", isManager: false },
    { fullName: "Andrzej Zakrzewski", memberId: "38", isManager: false },
    { fullName: "Beata Dytrych", memberId: "39", isManager: true },
    { fullName: "Bohdana-Zlata Honcharenko", memberId: "50", isManager: false },
    { fullName: "Borys Struski", memberId: "11", isManager: false },
    { fullName: "Daniel Dymov", memberId: "71", isManager: false },
    { fullName: "Dawid Kręciszewski", memberId: "23", isManager: false },
    { fullName: "Edgar Buzo", memberId: "40", isManager: false },
    { fullName: "Eryk Brzeszczyński", memberId: "29", isManager: false },
    { fullName: "Ievgeniia Chaika", memberId: "10", isManager: false },
    { fullName: "Jakub Rogalski", memberId: "24", isManager: false },
    { fullName: "Jakub Romanowski", memberId: "65", isManager: false },
    { fullName: "Jan Kawalec", memberId: "57", isManager: false },
    { fullName: "Kacper Stadnicki", memberId: "26", isManager: false },
    { fullName: "Kamil TECH Kempisty", memberId: "69", isManager: true },
    { fullName: "Kamila Ogniewska", memberId: "18", isManager: true },
    { fullName: "Karolina Piaszczyk", memberId: "17", isManager: false },
    { fullName: "Krzysztof Dubaj", memberId: "9", isManager: false },
    { fullName: "Łukasz Kulesza", memberId: "27", isManager: false },
    { fullName: "Łukasz Starościak", memberId: "42", isManager: true },
    { fullName: "Łukasz Szynkler", memberId: "72", isManager: false },
    { fullName: "Maciej Król", memberId: "33", isManager: false },
    { fullName: "Maja Kucharska", memberId: "58", isManager: false },
    { fullName: "Marcin Niedziela", memberId: "70", isManager: false },
    { fullName: "Marcin Prokop", memberId: "8", isManager: false },
    { fullName: "Marek Matuszewski", memberId: "67", isManager: false },
    { fullName: "Marta Debenko", memberId: "31", isManager: false },
    { fullName: "Martyna Lenar", memberId: "43", isManager: false },
    { fullName: "Martyna Pasik", memberId: "47", isManager: false },
    { fullName: "Michał Niemierski", memberId: "32", isManager: false },
    { fullName: "Michał Rybicki", memberId: "5", isManager: false },
    { fullName: "Oksana Kuzo", memberId: "55", isManager: false },
    { fullName: "Oleksandr Serdyuk", memberId: "4", isManager: false },
    { fullName: "Olena Savicheva", memberId: "25", isManager: false },
    { fullName: "Patryk Kaliszuk", memberId: "6", isManager: false },
    { fullName: "Patryk Postawski", memberId: "7", isManager: false },
    { fullName: "Piotr Marciniak", memberId: "34", isManager: false },
    { fullName: "Tomasz Bujnowski", memberId: "14", isManager: false },
    { fullName: "Tomasz Wieczorek", memberId: "15", isManager: false },
    { fullName: "Tomasz Pawlik", memberId: "13", isManager: false },
    { fullName: "Tomasz Wilk", memberId: "60", isManager: false },
    { fullName: "ZPK", memberId: "2", isManager: true }
];

// Funkcja generująca plik JSON dla użytkownika
function generateUserJson(user) {
    return {
        status: "Aktywny",
        fullName: user.fullName,
        isManager: user.isManager,
        memberId: user.memberId
    };
}

// Funkcja zapisująca pliki JSON
async function generateAllUserFiles() {
    for (const user of ACTIVE_USERS) {
        const userData = generateUserJson(user);
        const fileName = `users/${user.memberId}.json`;
        
        // Tutaj logika zapisu pliku
        console.log(`Generating ${fileName}:`, userData);
    }
}

export { ACTIVE_USERS, generateUserJson, generateAllUserFiles };

export async function getUserByMemberId(memberId) {
    try {
        // Najpierw sprawdź cache
        const cachedUser = await getFromCache(`user_${memberId}`);
        if (cachedUser) {
            return JSON.parse(cachedUser);
        }

        // Jeśli nie ma w cache, spróbuj załadować z pliku
        const response = await fetch(chrome.runtime.getURL(`users/${memberId}.json`));
        if (!response.ok) {
            throw new Error(`User file not found for member ID: ${memberId}`);
        }

        const userData = await response.json();
        
        // Zapisz w cache na przyszłość
        await saveToCache(`user_${memberId}`, JSON.stringify(userData));
        
        return userData;
    } catch (error) {
        console.error('Error loading user data:', error);
        return null;
    }
} 