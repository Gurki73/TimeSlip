// js/loader/loader.js
import { globalRefresh } from '../renderer.js';

const validHomeKeys = ['auto', 'sample', 'client'];

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

    if (effectiveKey === 'sample') {
        try {
            return await fallbackFunc();
        } catch {
            console.log(" error loading fall back stuff");
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

            showSuccess(`✅ ${fileName} gespeichert`);
            console.log(`✅ Successfully saved ${fileName} → ${savedPath}`);
        } else {
            showFailure(`⚠️ ${fileName} konnte nicht gespeichert werden`);
            console.warn(`⚠ Failed to save ${fileName}`);
        }

        globalRefresh('client');
        return savedPath;
    } catch (err) {
        showFailure(`❌ Fehler beim Speichern von ${fileName}`);
        console.error(`❌ Error saving ${fileName}:`, err);
        throw err;
    }
}
