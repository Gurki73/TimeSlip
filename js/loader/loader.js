// js/loader/loader.js
import { globalRefresh } from '../renderer.js';

export const states = [
    { code: 'XX', name: 'Nimmerland' },
    { code: 'SH', name: 'Schleswig-Holstein' },
    { code: 'NI', name: 'Niedersachsen' },
    { code: 'MV', name: 'Mecklenburg-Vorpommern' },
    { code: 'HB', name: 'Bremen' },
    { code: 'HH', name: 'Hamburg' },
    { code: 'NW', name: 'Nordrhein-Westfalen' },
    { code: 'BB', name: 'Brandenburg' },
    { code: 'BE', name: 'Berlin' },
    { code: 'ST', name: 'Sachsen-Anhalt' },
    { code: 'HE', name: 'Hessen' },
    { code: 'TH', name: 'Thüringen' },
    { code: 'RP', name: 'Rheinland-Pfalz' },
    { code: 'BW', name: 'Baden-Württemberg' },
    { code: 'SN', name: 'Sachsen' },
    { code: 'SL', name: 'Saarland' },
    { code: 'BY', name: 'Bayern' },
];

const validHomeKeys = ['auto', 'sample', 'client'];

const friendlyNames = {
    'employee.csv': 'Mitarbeiter Liste',
    'bridgeDays.csv': 'Brückentage',
    'officeDays.csv': 'geöffnete Tage',
    'publicHolidays.csv': 'Feiertage',
    'state.txt': 'Bundesland',
    '2025.csv': 'Betriebsferien für Jahr xxxx', // <== need another fix here
    '2025_requests.csv': 'Urlaubsanträge für Jahr xxxx', // <== need another fix here
    'emojis.json': 'Benutzerdefinierte Icons',
    'HB_2025_holidays.csv': 'Schulferien Jahr xxxx in Bundesland', // // <== need another fix here for state and year
    'role.csv': 'Aufgaben',
    'teamnames.csv': 'Teamnamen',
    'rule_002.json': 'Regel', // <= maybe skip id
};



function getFriendlyName(fileName) {

    const cleanName = fileName.replace(/\.\w+$/, '');
    // 1. Static map first
    if (friendlyNames[fileName]) return friendlyNames[fileName];

    // 2. Dynamic patterns
    const yearMatch = fileName.match(/(\d{4})/); // match 4-digit year
    const year = yearMatch ? yearMatch[1] : '';

    if (/^\d{4}\.csv$/.test(fileName)) {
        return `Betriebsferien für Jahr ${year}`;
    }

    if (/^\d{4}_requests\.csv$/.test(fileName)) {
        return `Urlaubsanträge für Jahr ${year}`;
    }

    // Pattern for state-specific holidays: e.g., HB_2025_holidays.csv
    const stateMatch = fileName.match(/^([A-Z]{2})_(\d{4})_holidays\.csv$/);
    if (stateMatch) {
        const stateCode = stateMatch[1];
        const state = states.find(s => s.code === stateCode);
        const stateName = state ? state.name : stateCode;
        return `Schulferien Jahr ${stateMatch[2]} in ${stateName}`;
    }

    // fallback: remove extension
    return fileName.replace(/\.\w+$/, '');
}

// --- Popup feedback helpers ---
function showSuccess(message) {
    let popup = document.createElement("div");
    popup.className = "request-popup-success noto";
    popup.textContent = message;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 2500);
}

function showFailure(message) {
    let popup = document.createElement("div");
    popup.className = "request-popup-failure noto";
    popup.textContent = message;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 3000);
}

// --- Loader logic ---
export async function loadFile(api, homeKey, relativePath, fallbackFunc = null, forceReload = true) {
    if (!api) throw new Error('API reference missing');

    // 1️⃣ Determine effective homeKey
    let effectiveKey = localStorage.getItem('dataMode') || homeKey || 'auto';
    if (!validHomeKeys.includes(effectiveKey)) {
        console.warn(`⚠ localStorage dataMode "${effectiveKey}" invalid, falling back to "${homeKey || 'auto'}"`);
        effectiveKey = validHomeKeys.includes(homeKey) ? homeKey : 'auto';
    }

    let fallbackDepth = 0;

    if (effectiveKey === 'sample') {
        fallbackDepth++;

        if (fallbackDepth > 3) {
            console.error('🔥 Possible infinite fallback loop detected');
            console.trace();
            throw new Error('Infinite fallback loop');
        }

        try {
            return await fallbackFunc();
        } catch (err) {
            console.log("error loading fallback stuff");
            console.trace();
            throw err; // IMPORTANT
        } finally {
            fallbackDepth--;
        }
    }

    const cacheKey = `${effectiveKey}:${relativePath}`;
    if (!forceReload && sessionStorage.getItem(cacheKey)) {
        console.warn(" RETURN CACHED DATA ONLY", relativePath);
        return JSON.parse(sessionStorage.getItem(cacheKey));
    }

    // 3️⃣ Load data
    let data = await api.loadCSV(effectiveKey, relativePath);
    if (data) {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
    }

    // 4️⃣ Use fallback function if provided
    if (fallbackFunc) {
        console.warn(`⚠ No data found at ${relativePath}, using fallback.`);
        return await fallbackFunc();
    }

    return null;
}

// --- Unified save logic with automatic feedback ---
export async function saveFile(api, folderPath, fileName, content) {
    if (!api) throw new Error('API reference missing');

    const friendlyName = getFriendlyName(fileName);

    try {
        const savedPath = await api.saveCSV(folderPath, fileName, content);

        if (savedPath) {
            const toggle = document.getElementById('branch-toggle');
            const oldMode = localStorage.getItem('dataMode');

            if (toggle && typeof toggle.setMode === 'function') {
                if (oldMode !== 'client') {
                    toggle.setMode('client');
                }
            } else {
                if (oldMode !== 'client') {
                    localStorage.setItem('dataMode', 'client');
                    window.dispatchEvent(new CustomEvent('dataModeChanged', { detail: 'client' }));
                }
            }

            showSuccess(`✅ ${friendlyName} gespeichert`);
            console.log(`✅ Successfully saved ${fileName} → ${savedPath}`);
        } else {
            showFailure(`⚠️ ${friendlyName} konnte nicht gespeichert werden`);
            console.warn(`⚠ Failed to save ${fileName}`);
        }

        globalRefresh('client');
        return savedPath;
    } catch (err) {
        showFailure(`❌ Fehler beim Speichern von ${friendlyName}`);
        console.error(`❌ Error saving ${fileName}:`, err);
        throw err;
    }
}
