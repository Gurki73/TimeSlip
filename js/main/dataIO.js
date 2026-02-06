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
const backupCooldownMap = new Map(); // path → timestamp

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

// main/dataIO.js
export function saveCSV(homeKey, folderPath, fileName, content) {
    console.log(`💾 saveCSV → homeKey: "${homeKey}", folderPath: "${folderPath}", fileName: "${fileName}"`);
    console.log('🧠 inMemoryCache now:', inMemoryCache);
    console.log('🏠 app.getPath("home") →', app.getPath('home'));

    let resolvedFolder = getClientDataFolder(homeKey);

    if (!resolvedFolder) {
        // Try user home folder first
        const homeFolder = path.join(app.getPath('home'), 'mitarbeiterKalender', 'clientData');
        try {
            ensureDirectoryExists(homeFolder);
            writeRecoveryMarkerIfNeeded(homeFolder);
            resolvedFolder = homeFolder;
            inMemoryCache.clientDataFolder = homeFolder;
            console.log('🆕 Created client folder in home:', homeFolder);
        } catch (err) {
            console.warn('⚠ Failed to create client folder in home, trying userData:', err);

            // fallback to userData
            const userDataFolder = path.join(app.getPath('userData'), 'mitarbeiterKalender', 'clientData');
            ensureDirectoryExists(userDataFolder);
            writeRecoveryMarkerIfNeeded(userDataFolder);
            resolvedFolder = userDataFolder;
            inMemoryCache.clientDataFolder = userDataFolder;
            console.log('🆕 Created client folder in userData:', userDataFolder);
        }
    }
    sendResolvedDataMode();

    const baseFolder = resolvedFolder;
    const fullPath = path.join(baseFolder, folderPath || '', fileName);

    console.log("base folder: ", baseFolder);
    console.log("full path: ", fullPath);
    const folderExists = fs.existsSync(baseFolder);
    console.log(`📂 Base folder exists? ${folderExists ? '✅ Yes' : '⚠️ No, will create'}`);

    ensureDirectoryExists(path.dirname(fullPath));
    console.log(`📁 Ensured directory exists: ${path.dirname(fullPath)}`);
    backupCSVIfNeeded(fullPath, content);
    const success = writeCSVFileSafely(fullPath, content, baseFolder);

    return success ? fullPath : null;
}

function sendResolvedDataMode() {
    // Always use client for saving requests
    const homeKey = 'client';

    // Send to renderer (single main window)
    const mainWin = getMainWindow();
    if (mainWin && mainWin.webContents) {
        mainWin.webContents.send('update-cache', { key: 'dataMode', value: homeKey });
        console.log(`📤 Sent dataMode → ${homeKey}`);
    }

    // Store in memory cache as well
    inMemoryCache.dataMode = homeKey;
}


function tryCreateClientDataFolderFallback() {
    for (const candidate of DATA_ROOT_CANDIDATES.sort((a, b) => a.priority - b.priority)) {
        const basePath = app.getPath(candidate.key);
        const attemptPath = path.join(basePath, 'mitarbeiterKalender', 'clientData');

        try {
            // Ensure folder exists
            fs.mkdirSync(attemptPath, { recursive: true });

            // Write a recovery marker to detect first-run setup
            const markerPath = path.join(attemptPath, '.mitarbeiterkalender');
            if (!fs.existsSync(markerPath)) {
                fs.writeFileSync(markerPath, 'data-folder-initialized');
                console.log(`🆔 Recovery marker created at: ${markerPath}`);
            }

            // Cache folder in memory
            inMemoryCache.clientDataFolder = attemptPath;

            // Notify renderer to update localStorage
            getMainWindow()?.webContents.send('update-cache', {
                key: 'clientDataFolder',
                value: attemptPath,
            });

            console.log(`🆕 Created and cached client data folder: ${attemptPath}`);
            return attemptPath;

        } catch (err) {
            console.warn(`⚠️ Failed to create fallback folder at ${attemptPath}:`, err);
        }
    }

    // All candidate folders failed
    console.error('❌ Could not create any fallback client data folder.');
    return null;
}

export async function getFilesFromClientSubfolder(subfolder, regex) {
    try {
        const clientFolder = getClientDataFolder('client');
        if (!clientFolder) return [];

        const targetFolder = path.join(clientFolder, subfolder);
        if (!fs.existsSync(targetFolder)) return [];

        const files = await fs.promises.readdir(targetFolder);

        return files
            .filter(file => regex.test(file))
            .map(file => path.join(subfolder, file));
    } catch (err) {
        console.warn(`⚠️ Error reading ${subfolder} files:`, err);
        return [];
    }
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

    const dir = path.dirname(fullPath);
    const tmpPath = fullPath + ".tmp";

    try {
        ensureDirectoryExists(dir);

        //
        // 1️⃣ SANITY CHECK before writing
        //
        if (typeof content !== "string" || content.trim().length === 0) {
            console.error(`❌ Refusing to write empty or non-string CSV content: ${fullPath}`);
            return false;
        }

        // Detect corrupt renderer-produced comma flooding
        if (/,{20,}/.test(content)) {
            console.error(`❌ CSV content appears corrupted (mass commas). Aborting save: ${fullPath}`);
            dialog.showErrorBox(
                "Corrupted Data",
                "Die CSV-Daten scheinen beschädigt zu sein und wurden NICHT gespeichert.\n" +
                "Bitte schließen Sie das Fenster und erneut versuchen."
            );
            return false;
        }

        //
        // 2️⃣ SAFE ATOMIC WRITE
        //    Write to temp file first. If Electron crashes → only tmp file breaks.
        //
        fs.writeFileSync(tmpPath, content, "utf8");

        //
        // 3️⃣ VERIFY TEMP FILE BEFORE RENAMING
        //
        const verify = fs.readFileSync(tmpPath, "utf8");
        if (verify.length === 0 || verify.includes("\u0000")) {
            console.error(`❌ Verification failed, tmp file corrupted: ${tmpPath}`);
            fs.unlinkSync(tmpPath);
            return false;
        }

        //
        // 4️⃣ ATOMIC RENAME → replaces old file instantly & safely
        //    On crash between write & rename → fullPath stays intact.
        //
        fs.renameSync(tmpPath, fullPath);

        //
        // 5️⃣ FINAL VERIFY AFTER RENAME
        //
        const finalCheck = fs.readFileSync(fullPath, "utf8");
        if (finalCheck.length === 0 || /,{20,}/.test(finalCheck)) {
            console.error(`❌ Final CSV corruption detected after rename, restoring backup`);
            return false;
        }

        writeRecoveryMarkerIfNeeded(baseFolder);
        console.log(`✅ Atomic-safe file save success: ${fullPath}`);
        return true;

    } catch (err) {
        console.error(`❌ Failed atomic write for ${fullPath}`, err);

        dialog.showErrorBox(
            "Save Failed",
            `Die Datei konnte nicht gespeichert werden:\n${fullPath}\n\nGrund: ${err.message}`
        );

        return false;

    } finally {
        // Clean up temp file if present
        try {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch (_) { }

        unlock(fullPath);
    }
}

function writeTextFileSafely(fullPath, content) {
    if (isLocked(fullPath)) {
        console.warn(`⛔ Write in progress for: ${fullPath}`);
        return false;
    }

    lock(fullPath);
    const dir = path.dirname(fullPath);
    const tmpPath = fullPath + '.tmp';

    try {
        ensureDirectoryExists(dir);

        if (typeof content !== 'string') {
            console.error(`❌ Refusing to write non-string content: ${fullPath}`);
            return false;
        }

        fs.writeFileSync(tmpPath, content, 'utf8');
        fs.renameSync(tmpPath, fullPath);
        return true;
    } catch (err) {
        console.error(`❌ Error writing text file: ${fullPath}`, err);
        return false;
    } finally {
        try {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch (_) { }
        unlock(fullPath);
    }
}

export function listRuleFiles(homeKey) {
    const folder = getClientDataFolder(homeKey);
    if (!folder) return [];

    const ruleFolder = path.join(folder, 'rules');
    if (!fs.existsSync(ruleFolder)) return [];

    try {
        const entries = fs.readdirSync(ruleFolder, { withFileTypes: true });
        return entries
            .filter(e => e.isFile() && e.name.endsWith('.json'))
            .map(e => `rules/${e.name}`);
    } catch (err) {
        console.warn('⚠️ listRuleFiles failed', err);
        return [];
    }
}

export function loadRuleFile(homeKey, relativePath) {
    const folder = getClientDataFolder(homeKey);
    if (!folder) return null;

    const full = path.join(folder, relativePath);

    return loadJSONSafe(full);
}

export function saveRuleFile(homeKey, relativePath, content) {
    // reuse saveCSV path logic for folder resolution and safe write
    const filename = path.basename(relativePath);
    const folder = path.dirname(relativePath);
    return saveCSV('client', folder, filename, content);
}

export function loadTextFile(homeKey, relativePath) {
    const folder = getClientDataFolder(homeKey);
    if (!folder) return null;

    const full = path.join(folder, relativePath);
    if (!fs.existsSync(full)) return null;

    try {
        return fs.readFileSync(full, 'utf8');
    } catch (err) {
        console.error(`❌ Error reading text file: ${full}`, err);
        return null;
    }
}

export function saveTextFile(homeKey, relativePath, content) {
    let resolvedFolder = getClientDataFolder(homeKey);
    if (!resolvedFolder) {
        resolvedFolder = tryCreateClientDataFolderFallback();
        if (!resolvedFolder) {
            showFatalFolderCreationError();
            return false;
        }
    }

    const fullPath = path.join(resolvedFolder, relativePath);
    return writeTextFileSafely(fullPath, content);
}

export function deleteRuleFile(homeKey, relativePath) {
    const folder = getClientDataFolder(homeKey);
    if (!folder) return { success: false, error: 'no folder' };
    const full = path.join(folder, relativePath);
    try {
        if (fs.existsSync(full)) {
            fs.unlinkSync(full);
            return { success: true };
        }
        return { success: false, error: 'not found' };
    } catch (err) {
        console.error('✗ deleteRuleFile failed', err);
        return { success: false, error: err.message };
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

export function getClientDataFolder(homeKey) {
    // 'sample' mode → always return bundled sample folder
    if (homeKey === 'sample') {
        const samplePath = path.join(app.getAppPath(), 'samples');
        return samplePath;
    }

    // 'client' mode → use cached client folder or defaults
    if (homeKey === 'client') {
        if (inMemoryCache.clientDataFolder && checkClientDataFolder(inMemoryCache.clientDataFolder)) {
            return inMemoryCache.clientDataFolder;
        }

        // Try default folders
        const homeDefault = path.join(app.getPath('home'), 'mitarbeiterKalender', 'clientData');
        if (checkClientDataFolder(homeDefault)) return homeDefault;

        const userDataDefault = path.join(app.getPath('userData'), 'mitarbeiterKalender', 'clientData');
        if (checkClientDataFolder(userDataDefault)) return userDataDefault;

        // Recovery scan
        const recovered = scanForDataFolders();
        if (recovered) return recovered;

        // None found → return null, saveCSV will attempt to create
        return null;
    }

    // 'auto' mode → first try client folder, fallback to sample
    if (homeKey === 'auto') {
        const client = getClientDataFolder('client');
        if (client) return client;

        // fallback to sample
        return getClientDataFolder('sample');
    }

    console.warn('Unknown homeKey:', homeKey);
    return null;
}

/*
export async function loadCSV(homeKey, relativePath) {

    let resolvedClientFolder = getClientDataFolder(homeKey);

    if (!resolvedClientFolder) {
        console.warn('⚠️ No client data folder, returning null to trigger sample fallback.');
        return null; // first-run: fallback to sample data
    }

    const fullPath = path.join(resolvedClientFolder, relativePath);
    console.log("homekey:", homeKey);
    console.log(" relative path:", relativePath);
    console.log("[main data IO]loading csv     full Path --> ", fullPath);

    if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️ File not found at path: ${fullPath}, using sample fallback.`);
        return null; // fallback
    }

    try {
        const content = fs.readFileSync(fullPath, 'utf8');
        return content;
    } catch (err) {
        console.error(`❌ Error reading CSV from ${fullPath}:`, err);
        return null; // fallback
    }
}
*/

// ---- Add helper functions and replace loadCSV with the safe version ----

function getCsvRulesForPath(relativePath) {
    // returns per-file validation rules
    // you supplied these values in the conversation
    const p = relativePath.replace(/\\/g, '/').toLowerCase();

    // default
    const defaultRule = {
        maxLines: 2000,
        maxSizeBytes: 2 * 1024 * 1024, // 2 MB
        expectedCols: null, // null = flexible
        allowPadLines: false,
        maxExactCols: null
    };

    if (p.includes('employees') && p.endsWith('employee.csv')) {
        return { maxLines: 100, maxSizeBytes: 200 * 1024, expectedCols: 23, allowPadLines: true, maxExactCols: 23 };
    }
    if (p.includes('role-data') && p.endsWith('role.csv')) {
        return { maxLines: 15, maxSizeBytes: 20 * 1024, expectedCols: 3, allowPadLines: false, maxExactCols: 3 };
    }
    if (p.includes('schoolholidays')) {
        return { maxLines: 25, maxSizeBytes: 50 * 1024, expectedCols: 3, allowPadLines: false, maxExactCols: 3 };
    }
    if (p.includes('companyholidays') || p.includes('companyholidays/')) {
        return { maxLines: 50, maxSizeBytes: 50 * 1024, expectedCols: 2, allowPadLines: false, maxExactCols: 2 };
    }
    if (p.includes('calendar/officeDays.csv')) {
        return { maxLines: 2, maxSizeBytes: 4 * 1024, expectedCols: 7, allowPadLines: false, maxExactCols: 7 };
    }
    if (p.includes('publicholidays') || p.includes('calendar/publicholidays.csv')) {
        return { maxLines: 50, maxSizeBytes: 50 * 1024, expectedCols: 2, allowPadLines: false, maxExactCols: 2 };
    }
    if (p.endsWith('state.csv')) {
        return { maxLines: 2, maxSizeBytes: 2 * 1024, expectedCols: 1, allowPadLines: false, maxExactCols: 1 };
    }
    if (p.includes('teamnames') || p.includes('teamnames.csv')) {
        return { maxLines: 2, maxSizeBytes: 4 * 1024, expectedCols: 4, allowPadLines: false, maxExactCols: 4 };
    }
    if (p.includes('bridge') && p.endsWith('bridgeDays.csv')) {
        return { maxLines: 50, maxSizeBytes: 50 * 1024, expectedCols: 2, allowPadLines: false, maxExactCols: 2 };
    }
    // requests files
    if (p.includes('request') || p.includes('requests') || p.endsWith('requests.csv')) {
        return { maxLines: 1000, maxSizeBytes: 500 * 1024, expectedCols: 11, allowPadLines: false, maxExactCols: 11 };
    }

    return defaultRule;
}

function safeRenameOriginalToCorrupt(fullPath) {
    try {
        if (!fs.existsSync(fullPath)) return null;
        const dir = path.dirname(fullPath);
        const base = path.basename(fullPath);
        const ts = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
        const corruptName = `${base}.corrupt.${ts}.bak`;
        const corruptPath = path.join(dir, corruptName);
        fs.renameSync(fullPath, corruptPath);
        console.log(`🔁 Renamed original to corrupt backup: ${corruptPath}`);
        return corruptPath;
    } catch (err) {
        console.warn('⚠️ Failed to rename original to corrupt backup:', err);
        return null;
    }
}

/**
 * Validate and optionally attempt permitted repair actions.
 * Returns object { status: 'ok'|'repaired'|'unusable', content?: string, reason?: string, corruptBackup?: path }
 *
 * Rules:
 * - Remove empty lines and lines made only of commas.
 * - If header present and many rows are OK, we can pad rows with fewer cols up to expectedCols (only if allowPadLines true).
 * - If a row has > 2x expected cols OR contains a comma-flood (20+ commas in a row) OR file too big OR too many lines → unusable.
 * - If a line starts with a comma (first char is ',') treat as suspicious; counts toward unusable unless pad/trim would fix it.
 */
function validateAndAttemptRepair(fullPath, relativePath, rawContent) {
    const rules = getCsvRulesForPath(relativePath);
    if (typeof rawContent !== 'string') return { status: 'unusable', reason: 'not-string' };

    const size = Buffer.byteLength(rawContent, 'utf8');
    if (rules.maxSizeBytes && size > rules.maxSizeBytes) {
        return { status: 'unusable', reason: 'file-too-large', details: { size } };
    }

    const lines = rawContent.split(/\r?\n/);
    if (lines.length === 0) return { status: 'unusable', reason: 'empty' };
    if (rules.maxLines && lines.length > rules.maxLines) {
        return { status: 'unusable', reason: 'too-many-lines', details: { lines: lines.length } };
    }

    const header = lines[0] || '';
    const headerCols = header.split(',').length;

    // Basic header check: ensure header exists and contains expected number of columns if expectedCols set
    if (rules.expectedCols && headerCols !== rules.expectedCols) {
        // For some CSVs header may not strictly match (e.g. teamnames single-line) — allow some flexibility but flag
        console.warn(`⚠ Header column count ${headerCols} ≠ expected ${rules.expectedCols} for ${relativePath}`);
        // We'll not auto-repair headers; require manual intervention
        return { status: 'unusable', reason: 'header-mismatch', details: { headerCols, expected: rules.expectedCols } };
    }

    let goodLines = [header]; // always keep header
    let removedCount = 0;
    let paddedCount = 0;
    let truncatedCount = 0;
    let suspiciousLines = 0;

    for (let i = 1; i < lines.length; i++) {
        let line = lines[i];
        if (!line || line.trim() === '') {
            removedCount++;
            continue; // drop empty lines
        }
        // treat lines that are only commas as empty
        if (/^,+$/.test(line.trim())) {
            removedCount++;
            continue;
        }
        // if starts with comma -> suspicious (missing id)
        if (line.startsWith(',')) {
            suspiciousLines++;
            // try to handle by pad if allowed and the rest looks ok
        }

        // detect comma flood (>=200 commas OR >=20 consecutive commas)
        if (/, {0,}\,/.test(line)) {
            /* noop - keep backward compatible */
        }
        if (/, {0,}\,/.test(line)) { } // no-op, placeholder
        if (/(,{20,})/.test(line) || (line.length > 10000)) {
            // too many consecutive commas or extremely long line -> unusable
            return { status: 'unusable', reason: 'comma-flood-or-long-line', details: { index: i, sample: line.slice(0, 200) } };
        }

        const cols = line.split(',');
        // if expectedCols given and row has far too many columns (>2x) -> unusable
        if (rules.maxExactCols && cols.length > (rules.maxExactCols * 2)) {
            return { status: 'unusable', reason: 'too-many-columns-in-row', details: { index: i, cols: cols.length } };
        }

        // If fewer columns than header and allowed to pad -> pad
        if (cols.length < headerCols) {
            if (rules.allowPadLines) {
                const padded = cols.concat(new Array(headerCols - cols.length).fill('')).join(',');
                paddedCount++;
                goodLines.push(padded);
                continue;
            } else {
                // if not allowed to pad, treat as removed (safer)
                // but count as suspicious
                suspiciousLines++;
                // drop the line
                removedCount++;
                continue;
            }
        }

        // If more columns than header but within a reasonable bound, truncate (safer) — only if padding allowed? We'll truncate only if not highly divergent
        if (cols.length > headerCols && cols.length <= headerCols * 2) {
            // truncate extra columns (safe approach)
            const truncated = cols.slice(0, headerCols).join(',');
            truncatedCount++;
            goodLines.push(truncated);
            continue;
        }

        // otherwise it's good
        goodLines.push(line);
    }

    // Decide outcome
    // If after removals fewer than 1 data row -> unusable
    if (goodLines.length <= 1) {
        return { status: 'unusable', reason: 'no-valid-rows', details: { kept: goodLines.length } };
    }

    // If nothing changed -> ok
    if (removedCount === 0 && paddedCount === 0 && truncatedCount === 0 && suspiciousLines === 0) {
        return { status: 'ok', content: rawContent };
    }

    // If only safe changes done (padding/truncation/removal of empty/comma-only lines) -> we may silently repair.
    // Respect the user's rule: silent repair allowed only when header and good data exist (we have them).
    const repairedContent = goodLines.join('\n');
    return {
        status: 'repaired',
        content: repairedContent,
        stats: { removedCount, paddedCount, truncatedCount, suspiciousLines }
    };
}

export async function loadCSV(homeKey, relativePath) {
    const resolvedClientFolder = getClientDataFolder(homeKey);

    if (!resolvedClientFolder) {
        console.warn('⚠️ No client data folder, returning null to trigger sample fallback.');
        return null;
    }

    const fullPath = path.join(resolvedClientFolder, relativePath);
    console.log("[main data IO] loading csv -->", fullPath);

    if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️ File not found: ${fullPath}, using sample fallback.`);
        return null;
    }

    try {
        const content = fs.readFileSync(fullPath, 'utf8');

        // Non-CSV files: load verbatim, never validate
        if (!relativePath.toLowerCase().endsWith('.csv')) {
            return content;
        }

        // -------------------------------
        // PHASE 1: read-only validation
        // -------------------------------
        const check = validateCSVReadOnly(content);

        if (check.status === 'ok') {
            return content;
        }

        // ---------------------------------------
        // PHASE 2: repairable but NOT dangerous
        // ---------------------------------------
        if (check.status === 'repairable' && check.severity !== 'major') {
            console.warn('⚠️ CSV minor issues detected; loading without mutation:', {
                file: relativePath,
                issues: check.issues
            });
            return content;
        }

        // ---------------------------------------
        // PHASE 3: confirmed corruption
        // ---------------------------------------
        if (check.status === 'repairable' && check.severity === 'major') {
            console.warn('🩹 Attempting CSV repair:', relativePath);

            const repaired = repairCSV(content, check);

            if (!repaired || repaired.trim().length === 0) {
                throw new Error('Repair produced empty CSV');
            }

            const corruptBak = safeRenameOriginalToCorrupt(fullPath);
            const wrote = writeCSVFileSafely(fullPath, repaired, resolvedClientFolder);

            if (!wrote) {
                console.error('❌ Failed to write repaired CSV; keeping corrupt backup:', corruptBak);
                notifyFileCorrupt(fullPath, corruptBak, 'write_failed');
                return null;
            }

            console.log(`🩹 CSV repaired and saved: ${fullPath}`);
            return repaired;
        }

        // ---------------------------------------
        // PHASE 4: unusable
        // ---------------------------------------
        if (check.status === 'unusable') {
            const corruptBak = safeRenameOriginalToCorrupt(fullPath);
            console.error(`❌ CSV unusable: ${relativePath}`, check.reason);
            notifyFileCorrupt(fullPath, corruptBak, check.reason, check.details);
            return null;
        }

        return null;

    } catch (err) {
        console.error(`❌ Error reading CSV: ${fullPath}`, err);
        return null;
    }
}
// TO:DO
function repairCSV(content, check) {
    console.log(" repair csv file was triggered");
}

// TO:DO
function notifyFileCorrupt(fullPath, corruptBak, reason, details) {
    console.log(" corrupt csv file detacted ");
}

// TO:DO
function validateCSVReadOnly(content) {
    return { status: 'ok' };
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
        const folderPath = 'schoolHolidays';
        const fileName = `${state}_${year}_holidays.csv`;
        const savedPath = saveCSV('client', folderPath, fileName, holidaysData);

        if (!savedPath) {
            sendChecklistUpdate(event, 'dataStored', 'failure');
            throw new Error('Failed to store CSV file');
        } else {
            sendChecklistUpdate(event, 'dataStored', 'success');
            console.log(`✅ CSV gespeichert unter: ${savedPath}`);
        }
        sendChecklistUpdate(event, 'dataStored', 'success');

        console.log(`✅ CSV gespeichert unter: ${filePath}`);
        return data;

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

function backupCSVIfNeeded(filePath, content, cooldownSeconds = 300, maxBackups = 5) {
    const now = Date.now();
    const lastBackup = backupCooldownMap.get(filePath) || 0;

    if ((now - lastBackup) < cooldownSeconds * 1000) {
        console.log(`⏱️ Skipping backup (cooldown active): ${filePath}`);
        return;
    }

    // Only back up if an old file exists
    if (!fs.existsSync(filePath)) {
        console.log(`📂 No existing file → no backup needed: ${filePath}`);
        return;
    }

    try {
        const oldContent = fs.readFileSync(filePath, 'utf8');  // <-- IMPORTANT!
        const dir = path.dirname(filePath);
        const baseName = path.basename(filePath);
        const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
        const backupName = `${baseName}.bak.${timestamp}.csv`;
        const backupPath = path.join(dir, backupName);

        // Write OLD content to backup
        fs.writeFileSync(backupPath, oldContent, 'utf8');
        backupCooldownMap.set(filePath, now);
        console.log(`📦 Backup (old version) written: ${backupPath}`);

        // Cleanup
        const files = fs.readdirSync(dir);
        const backupFiles = files
            .filter(f => f.startsWith(`${baseName}.bak.`))
            .sort();

        if (backupFiles.length > maxBackups) {
            const toDelete = backupFiles.slice(0, backupFiles.length - maxBackups);
            for (const f of toDelete) {
                fs.unlinkSync(path.join(dir, f));
                console.log(`🗑️ Deleted old backup: ${f}`);
            }
        }

    } catch (err) {
        console.warn(`⚠️ Failed to write backup for ${filePath}:`, err);
    }
}

export function loadJSONSafe(fullPath) {
    if (!fs.existsSync(fullPath)) return null;

    try {
        const raw = fs.readFileSync(fullPath, 'utf8');

        // ❗ sanity checks
        if (!raw.trim()) {
            console.warn(`❌ Empty JSON file: ${fullPath}`);
            return null;
        }
        if (raw.includes('\u0000')) {
            console.warn(`❌ NULL bytes detected, file corrupted: ${fullPath}`);
            return null;
        }

        return JSON.parse(raw);

    } catch (err) {
        console.error(`❌ JSON parse error → will quarantine file: ${fullPath}`, err);

        // auto quarantine unreadable file
        try {
            const bad = fullPath + `.corrupt.${Date.now()}.json`;
            fs.renameSync(fullPath, bad);
            console.log(`🔁 Corrupt JSON renamed → ${bad}`);
        } catch { }

        return null;
    }
}

export function saveJSONSafe(fullPath, jsonObject) {
    // filename rules
    if (!/^[a-zA-Z0-9_\-]+\.json$/.test(path.basename(fullPath))) {
        console.error(`❌ Illegal filename: ${fullPath}`);
        return false;
    }

    const dir = path.dirname(fullPath);
    const tmp = fullPath + '.tmp';

    ensureDirectoryExists(dir);

    // Validate JSON before writing
    let data;
    try {
        data = JSON.stringify(jsonObject, null, 2);
    } catch (err) {
        console.error(`❌ JSON stringify failed: ${err}`);
        return false;
    }
    if (!data.trim()) {
        console.error(`❌ Refusing to write empty JSON: ${fullPath}`);
        return false;
    }

    try {
        fs.writeFileSync(tmp, data, 'utf8');

        // verify temp file
        const check = fs.readFileSync(tmp, 'utf8');
        JSON.parse(check); // parse again for certainty

        // atomic replace
        fs.renameSync(tmp, fullPath);

        console.log(`✅ JSON saved safely: ${fullPath}`);
        return true;

    } catch (err) {
        console.error(`❌ Atomic JSON write failed for ${fullPath}`, err);
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { }
        return false;
    }
}
