/**
/**
 * 📁 Client Data Folder Strategy – Design Decision
 *
 * To determine where user-generated data should be stored or loaded from, we rank available paths by reliability and user-friendliness:
 *
 * Priority:
 *  1. app.getPath('userData') – Most reliable. Managed by Electron, OS-native, requires no user interaction.
 *  2. localStorage-defined path – Allows user override, but clients may lack technical experience, so use cautiously.
 *  3. app.getPath('home') – Last resort. Easier to find, but messy and inconsistent across platforms.
 *
 * This layered approach ensures:
 *  - Robust fallback behavior
 *  - A non-frustrating user experience
 *  - Flexibility for future user configuration
 *  - Avoids problematic folders like shared, cloud, or synced directories that may have permission issues or sync delays.
 *
 * Separation of Logic:
 *  - Loader and storer scripts live in the main process to avoid bloating main.js
 *  - Frontend (renderer) requests data access through a clean API (via context bridge)
 *
 * 🧠 We avoid asking users to choose paths unless absolutely necessary.
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
            fullPath = path.join(__dirname, '../sampleData', relativePath);
            break;
        default:
            console.warn('❌ Unknown homeKey:', homeKey);
            return false;
    }

    const exists = fs.existsSync(fullPath);
    console.log(`🧪 [${homeKey}] Path checked: ${fullPath} → ${exists ? '✅ Found' : '❌ Missing'}`);
    return exists;
}


export function loadCSV(relativePath, homeKey = 'userData') {
    const baseDir = app.getPath(homeKey);
    const fullPath = path.join(baseDir, relativePath);

    console.log(`📂 Loading CSV from: ${fullPath}`);
    try {
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            return content;
        } else {
            console.warn(`❌ File not found: ${fullPath}`);
            return null;
        }
    } catch (err) {
        console.error(`❌ Error reading CSV: ${fullPath}`, err);
        return null;
    }
}
