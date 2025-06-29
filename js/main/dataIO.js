import { app, dialog, webContents } from 'electron';
import path from 'path';
import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { inMemoryCache, DATA_ROOT_CANDIDATES } from './shared.js';
import { getMainWindow } from './appWindow.js';
import { userInfo } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RECOVERY_MARKER = '.mitarbeiterkalender';
const writeLocks = new Set();

const BLACKLISTED_PATHS = [
    app.getPath('downloads'),
    app.getPath('temp'),
    app.getPath('desktop'),
    app.getPath('documents'), // 🆕 Add this line
    '/tmp',                   // Linux
    '/var',
    '/proc',
    '/dev',
    'C:\\Windows\\Temp',
    'C:\\Windows\\System32',
    'C:\\Program Files',
];

/**
 * 📁 Client Data Folder Strategy – Check Path Availability
 * This function checks the existence of a given path.
 */
export function checkPath(homeKey, relativePath) {
    let fullPath = '';

    switch (homeKey) {
        case 'userData':
            fullPath = path.join(app.getPath('userData'), relativePath);
            break;
        case 'client':
            fullPath = relativePath; // absolute path from renderer
            break;
        case 'home':
            fullPath = path.join(app.getPath('home'), relativePath);
            break;
        case 'sample':
            const installDir = app.getAppPath();
            fullPath = path.join(installDir, relativePath);
            break;
        default:
            console.warn('❌ Unknown homeKey:', homeKey);
            return false;
    }

    const exists = fs.existsSync(fullPath);
    console.log(`🧪 [${homeKey}] Path checked: ${fullPath} → ${exists ? '✅ Found' : '❌ Missing'}`);
    return exists;
}

function isLocked(path) {
    return writeLocks.has(path);
}

function lock(filePath) {
    writeLocks.add(filePath);
}

function unlock(filePath) {
    writeLocks.delete(filePath);
}

function writeRecoveryMarkerIfNeeded(homeFolderPath) {
    const markerPath = path.join(homeFolderPath, RECOVERY_MARKER);
    if (!fs.existsSync(markerPath)) {
        fs.writeFileSync(markerPath, 'home-folder-initialized');
        console.log(`🆔 Recovery marker written to: ${markerPath}`);
    }
}

export function saveCSV(homeKey, relativePath, content) {
    console.log(`💾 saveCSV → homeKey: "${homeKey}", relativePath: "${relativePath}"`);
    console.log('🧠 inMemoryCache now:', inMemoryCache);

    let resolvedClientFolder = getClientDataFolder(homeKey);

    if (!resolvedClientFolder) {
        resolvedClientFolder = tryCreateClientDataFolderFallback();
        if (!resolvedClientFolder) {
            showFatalFolderCreationError();
            return null;
        }
    }

    const fullPath = path.join(resolvedClientFolder, relativePath);
    const success = writeCSVFileSafely(fullPath, content, resolvedClientFolder);

    return success ? fullPath : null;
}

function tryCreateClientDataFolderFallback() {
    for (const candidate of DATA_ROOT_CANDIDATES.sort((a, b) => a.priority - b.priority)) {
        const basePath = app.getPath(candidate.key);
        const attemptPath = path.join(basePath, 'mitarbeiterKalender', 'clientData');

        try {
            fs.mkdirSync(attemptPath, { recursive: true });

            // Marker + Cache + Notify
            const markerPath = path.join(attemptPath, '.mitarbeiterkalender');
            fs.writeFileSync(markerPath, 'data-folder-initialized');

            inMemoryCache.clientDataFolder = attemptPath;
            getMainWindow()?.webContents.send('update-cache', {
                key: 'clientDataFolder',
                value: attemptPath,
            });

            console.log(`🆕 Created and cached folder: ${attemptPath}`);
            return attemptPath;

        } catch (err) {
            console.warn(`⚠️ Failed to create fallback folder at ${attemptPath}:`, err);
        }
    }

    return null; // all fallbacks failed
}

function showFatalFolderCreationError() {
    dialog.showErrorBox(
        'Client Folder Creation Failed',
        'The application could not create a writable folder.\nCheck your disk permissions or contact support.'
    );
    console.error('❌ All folder creation attempts failed.');
}

function writeCSVFileSafely(fullPath, content, baseFolder) {
    if (isLocked(fullPath)) {
        console.warn(`⛔ Write in progress for: ${fullPath}`);
        return false;
    }

    lock(fullPath);

    try {
        ensureDirectoryExists(path.dirname(fullPath));
        fs.writeFileSync(fullPath, content, 'utf8');

        if (!fs.existsSync(fullPath)) {
            console.error(`❌ Write verification failed: ${fullPath}`);
            return false;
        }

        writeRecoveryMarkerIfNeeded(baseFolder);
        console.log(`✅ File saved: ${fullPath}`);
        return true;

    } catch (err) {
        console.error(`❌ Failed to write CSV to ${fullPath}`, err);
        return false;

    } finally {
        unlock(fullPath);
    }
}

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function isBlacklisted(folderPath) {
    return BLACKLISTED_PATHS.some(blacklisted =>
        folderPath.toLowerCase().startsWith(blacklisted.toLowerCase())
    );
}

// for (const candidateFolder of possibleDataFolders) {
//     if (isBlacklisted(candidateFolder)) {
//         console.warn(`🚫 Skipping blacklisted folder: ${candidateFolder}`);
//         continue;
//     }
// 
//     if (fs.existsSync(path.join(candidateFolder, '.mitarbeiterkalender'))) {
//         return candidateFolder; // ✅ valid recovery candidate
//     }
// }

export function scanForDataFolders() {
    const candidates = [];

    // 1️⃣ Candidate base folders to scan
    const basePaths = [
        app.getPath('userData'),
        app.getPath('home'),
    ];

    for (const basePath of basePaths) {
        if (!fs.existsSync(basePath)) continue;

        try {
            const entries = fs.readdirSync(basePath, { withFileTypes: true });
            let skippedCount = 0;
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const folderPath = path.join(basePath, entry.name);

                if (isBlacklisted(folderPath)) {
                    skippedCount++;
                    continue;
                }

                const markerPath = path.join(folderPath, RECOVERY_MARKER);
                if (fs.existsSync(markerPath)) {
                    console.log(`🔍 Recovery marker found at: ${markerPath}`);
                    candidates.push(folderPath);
                }
            }
            if (skippedCount > 0) {
                console.log(`🚫 Skipped ${skippedCount} blacklisted folder${skippedCount > 1 ? 's' : ''}`);
            }
        } catch (err) {
            console.warn(`⚠️ Failed to scan ${basePath}`, err);
        }
    }

    if (candidates.length > 0) {
        console.log(`✅ Recovery candidate found: ${candidates[0]}`);
        return candidates[0]; // Return first found match
    }

    console.log('❌ No recovery marker found in scanned folders.');
    return null;
}

function checkClientDataFolder(folderPath) {
    if (!folderPath) return false;
    const markerPath = path.join(folderPath, RECOVERY_MARKER);
    return fs.existsSync(markerPath);
}

function getClientDataFolder(homeKeyPath) {
    // 1. Check if homeKeyPath is a valid path with marker
    if (homeKeyPath && checkClientDataFolder(homeKeyPath)) {
        console.log('Using homeKeyPath:', homeKeyPath);
        return homeKeyPath;
    }

    // 2. Check cache
    const cachedFolder = inMemoryCache.clientDataFolder;
    if (cachedFolder && checkClientDataFolder(cachedFolder)) {
        console.log('Using cached client data folder:', cachedFolder);
        return cachedFolder;
    }

    // 3. Check known default folders
    const homeDefault = path.join(app.getPath('home'), 'mitarbeiterKalender', 'clientData');
    if (checkClientDataFolder(homeDefault)) {
        console.log('Using home default folder:', homeDefault);
        return homeDefault;
    }

    const userDataDefault = path.join(app.getPath('userData'), 'mitarbeiterKalender', 'clientData');
    if (checkClientDataFolder(userDataDefault)) {
        console.log('Using userData default folder:', userDataDefault);
        return userDataDefault;
    }

    // 4. Recovery scan
    const recoveredPath = scanForDataFolders();
    if (recoveredPath) {
        console.log('Using recovered data folder:', recoveredPath);
        return recoveredPath;
    }

    // 5. No valid folder found
    console.warn('No valid client data folder found');
    return null;
}

export async function loadCSV(homeKey, relativePath) {
    console.log(`📥 loadCSV → homeKey: "${homeKey}", relativePath: "${relativePath}"`);

    let resolvedClientFolder = getClientDataFolder(homeKey);
    if (!resolvedClientFolder) {
        console.warn('⚠️ No client data folder could be resolved.');
        return null;
    }

    const fullPath = path.join(resolvedClientFolder, relativePath);

    if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️ File not found at path: ${fullPath}`);
        return null;
    } else {
        console.log(`🥳 File found at path: ${fullPath}`);
    }

    try {
        const content = fs.readFileSync(fullPath, 'utf8');
        // console.log(`📄 Content loaded from ${fullPath}:`, content);
        return content;
    } catch (err) {
        console.error(`❌ Error reading CSV from ${fullPath}:`, err);
        return null;
    }
}

function sendChecklistUpdate(event, step, status) {
    event?.sender?.send('download-checklist-update', step, status);
}

export async function downloadSchoolHolidays(state, year, event) {
    const filePath = path.join('schoolHolidays', `${state}_${year}_holidays.csv`);
    const url = 'https://openholidaysapi.org/SchoolHolidays';

    try {
        console.log('🌐 Starting request to OpenHolidays API...');

        const response = await axios.get(url, {
            params: {
                countryIsoCode: 'DE',
                validFrom: `${year}-01-01`,
                validTo: `${year}-12-31`,
                languageIsoCode: 'DE',
                subdivisionCode: `DE-${state}`
            },
            headers: {
                'Accept': 'application/json'
            }
        });

        console.log('📡 API request succeeded, response received.');
        sendChecklistUpdate(event, 'apiReachable', 'success');

        const data = response.data;
        console.log(`📦 Response data contains ${data?.length || 0} entries.`);

        if (!Array.isArray(data) || data.length === 0) {
            console.warn('⚠️ No holiday data found in response.');
            sendChecklistUpdate(event, 'dataReceived', 'failure');
            throw new Error('No holiday data received');
        } else {
            sendChecklistUpdate(event, 'dataReceived', 'success');
        }

        console.log('🛠️ Parsing holiday data to CSV...');
        const holidaysData = parseToCSV(data);
        sendChecklistUpdate(event, 'dataParsed', 'success');

        console.log(`💾 Writing CSV to file: ${filePath}`);
        const relativePath = `schoolHolidays/${state}_${year}_holidays.csv`;
        const savedPath = saveCSV('client', relativePath, holidaysData);

        if (!savedPath) {
            sendChecklistUpdate(event, 'dataStored', 'failure');
            throw new Error('Failed to store CSV file');
        } else {
            sendChecklistUpdate(event, 'dataStored', 'success');
            console.log(`✅ CSV gespeichert unter: ${savedPath}`);
        }
        sendChecklistUpdate(event, 'dataStored', 'success');

        console.log(`✅ CSV gespeichert unter: ${filePath}`);
        return holidaysData;

    } catch (err) {
        console.error('❌ Error fetching or saving holidays:', err);

        // Fallback: Assume all stages might've failed, just to be safe
        sendChecklistUpdate(event, 'apiReachable', 'failure');
        sendChecklistUpdate(event, 'dataReceived', 'failure');
        sendChecklistUpdate(event, 'dataStored', 'failure');

        return [];
    }

}

export function parseToCSV(data) {
    const header = 'Holiday Name,Start Date,End Date\n';
    const rows = data.map(h =>
        `${h.name[0]?.text || 'Unbenannt'},${h.startDate},${h.endDate}`
    ).join('\n');
    return header + rows;
}
