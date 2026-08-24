import { app, BrowserWindow, ipcMain, Menu, dialog, screen, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { inMemoryCache } from './shared.js';
import { loadFormAndSendToRenderer } from './events.js';
import { getClientDataFolder } from './dataIO.js';
import { exec } from 'child_process';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const backendLogs = [];
const MAX_BACKEND_LOGS = 500;

const ZOOM_LEVELS = [
    { label: '75%', factor: 0.75 },
    { label: '90%', factor: 0.9 },
    { label: '100%', factor: 1.0 },
    { label: '125%', factor: 1.25 },
    { label: '150%', factor: 1.5 },
];

let mainWindow;
let currentZoomFactor = 1.0;

const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = (...args) => {
    addBackendLog('INFO', ...args);
    originalConsoleLog(...args);
};

console.warn = (...args) => {
    addBackendLog('WARN', ...args);
    originalConsoleWarn(...args);
};

console.error = (...args) => {
    addBackendLog('ERROR', ...args);
    originalConsoleError(...args);
};

function setZoom(factor) {
    currentZoomFactor = factor;
    mainWindow.webContents.setZoomFactor(factor);
    updateZoomMenu();
}

function updateZoomMenu() {
    const menu = Menu.getApplicationMenu();
    const zoomMenu = menu.getMenuItemById('zoomMenu');
    if (zoomMenu) {
        zoomMenu.submenu.clear(); // Clear old items
        ZOOM_LEVELS.forEach(({ label, factor }) => {
            zoomMenu.submenu.append(new MenuItem({
                label,
                type: 'radio',
                checked: Math.abs(currentZoomFactor - factor) < 0.01,
                click: () => setZoom(factor)
            }));
        });
    }
}

function autoAdjustZoom() {
    const { width } = screen.getPrimaryDisplay().workAreaSize;

    if (width < 1600) {
        setZoom(0.75);
    } else if (width < 1920) {
        setZoom(0.9);
    } else if (width < 2560) {
        setZoom(1.0);
    } else {
        setZoom(1.25);
    }
}

function buildZoomSubmenu() {
    return ZOOM_LEVELS.map(({ label, factor }) => ({
        label,
        type: 'radio',
        checked: Math.abs(currentZoomFactor - factor) < 0.01,
        click: () => setZoom(factor),
    }));
}


function sendThemeToRenderer(themeName) {
    const focusedWindow = BrowserWindow.getFocusedWindow();

    if (focusedWindow) {
        focusedWindow.webContents.send('set-theme', themeName);
    } else {
        console.warn('[Theme] No focused window — could not send theme to renderer');
    }
}

async function createWindow() {
    const SAFE_MODE = false; // ← flip this to false once testing is done

    mainWindow = new BrowserWindow({
        width: 1600,
        height: 900,
        fullscreen: false,
        fullscreenable: false,
        frame: true,
        autoHideMenuBar: false,
        webPreferences: {
            preload: SAFE_MODE ? undefined : path.join(__dirname, '../../js/preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            sandbox: false,
            devTools: true
        }
    });
    mainWindow.maximize();
    mainWindow.setTitle(SAFE_MODE ? 'Mitarbeiter Kalender (Safe Mode)' : 'Mitarbeiter Kalender');

    if (SAFE_MODE) {
        await mainWindow.loadURL('data:text/html,<h1>🧩 Safe Mode Active</h1><p>No preload, no renderer</p>');
        return mainWindow;
    }

    try {
        await mainWindow.loadFile('./index.html');
    } catch (error) {
        console.error('Error loading index.html:', error);
    }

    const template = buildMenuTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    return mainWindow;
}

export function getMainWindow() {
    return mainWindow;
}

function sendPresenceUIMode(mode) {
    mainWindow.webContents.send('set-presence-ui-mode', mode);
}

function showShareAppDialog(browserWindow) {
    dialog.showMessageBox(browserWindow, {
        type: 'info',
        title: 'App weitergeben / Share App',
        message:
            'Sie können diese App gerne an Kollegen, Freunde oder Ihr Team weitergeben.\n' +
            'Wichtig: Nur den Installations-Installer weitergeben – nicht den Daten-Ordner.',
        detail:
            'Der Installer befindet sich im Ordner "Installer".\n' +
            'Wir öffnen ihn Ihnen jetzt. Kopieren Sie einfach die Datei:\n\n' +
            '→ MitarbeiterKalenderApp Setup XXXX.exe\n\n' +
            'Das Weitergeben ist erlaubt und erwünscht. Die App ist MIT-lizenziert.',
        buttons: ['OK', 'Installer-Ordner öffnen']
    }).then(result => {
        if (result.response === 1) {
            openInstallerFolder();
        }
    });
}

function openInstallerFolder() {
    const installerFolder = path.join(process.resourcesPath, '..', 'MitarbeiterKalender-Installer');

    if (fs.existsSync(installerFolder)) {
        shell.openPath(installerFolder);
    } else {
        dialog.showErrorBox(
            'Ordner nicht gefunden',
            'Der Installer-Ordner konnte nicht gefunden werden. Bitte prüfen Sie die Installation.'
        );
    }
}

function showStatusPanel(browserWindow) {
    if (!browserWindow) return;

    const version = app.getVersion();

    let cacheMessage;

    if (Object.keys(inMemoryCache).length === 0) {
        cacheMessage = 'Cache is empty.';
    } else {
        cacheMessage = Object.entries(inMemoryCache)
            .map(([key, value]) => `${key}: ${value || 'Not set'}`)
            .join('\n');
    }

    const logsMessage = backendLogs.length === 0
        ? 'Keine Backend-Logs vorhanden.'
        : backendLogs
            .map(log => `[${log.timestamp}] [${log.level}] ${log.message}`)
            .join('\n');

    const now = new Date();

    const formattedTime = new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(now);

    dialog.showMessageBox(browserWindow, {
        type: 'info',
        title: 'Statusfeld',
        message: `App version: ${version}\nStatus am ${formattedTime}`,
        detail:
            `=== CACHE ===\n` +
            `${cacheMessage}\n\n` +
            `=== BACKEND LOGS ===\n` +
            `${logsMessage}`,
        buttons: ['OK']
    });
}

function showLicenseDialog(browserWindow) {
    dialog.showMessageBox(browserWindow, {
        type: 'info',
        title: 'Lizenz / License',
        message: 'Diese App ist frei nutzbar, bearbeitbar und verkäuflich (unter der MIT-Lizenz.)\n\n' +
            'This app is free to use, modify, and sell under the MIT License.',
        detail: 'Sie können diese Software frei verwenden, verändern und vertreiben, auch kommerziell. Siehe LICENSE-Datei für Details.\n\n' +
            'You are free to use, modify, and distribute this software, even commercially. See LICENSE file for details.',
        buttons: ['OK']
    });
}

function showGitHubDialog(browserWindow) {
    dialog.showMessageBox(browserWindow, {
        type: 'info',
        title: 'GitHub Repository / GitHub Repository',
        message: 'Besuchen Sie unser GitHub-Repository:\nVisit our GitHub repository:',
        detail:
            'https://github.com/Gurki73/TimeSlip\n\n' +
            'Falls der Link nicht automatisch geöffnet wird, kopieren Sie ihn bitte und fügen Sie ihn in Ihren Browser ein.\n' +
            'If the link does not open automatically, please copy and paste it into your browser.',
        buttons: ['OK']
    });
}

function showAcknowledgementsDialog(browserWindow, topic) {
    const topics = {
        holidayApi: {
            title: 'Danksagungen / Acknowledgements',
            message: 'Diese App verwendet folgende API:\nThis app uses the following API:',
            detail:
                '- Open Holidays API (https://openholidaysapi.org/):\n' +
                '  Eine API zur einfachen Abfrage von Feiertagen weltweit.\n' +
                '  An API for easy access to public holidays worldwide.\n\n' +
                'Vielen Dank an die Entwickler für diese großartige Ressource!\n' +
                'Thank you to the developers for this great resource!'
        },
        electron: {
            title: 'Danksagungen / Acknowledgements',
            message: 'Diese App verwendet folgende Technologie\nThis app uses the following technology:',
            detail:
                '- Electron (https://www.electronjs.org/):\n' +
                '  Ein Framework zum Erstellen plattformübergreifender Desktop-Apps mit Web-Technologien.\n' +
                '  A framework for building cross-platform desktop apps using web technology.\n\n' +
                'Wir danken dem Electron-Team für die Bereitstellung dieser leistungsfähigen Plattform!\n' +
                'We thank the Electron team for providing this powerful platform!'
        },
        axios: {
            title: 'Danksagungen / Acknowledgements',
            message: 'Diese App verwendet folgende Bibliothek:\nThis app uses the following library:',
            detail:
                '- Axios (https://axios-http.com/):\n' +
                '  Eine Promise-basierte HTTP-Client-Bibliothek für den Browser und Node.js.\n' +
                '  A promise-based HTTP client for the browser and Node.js.\n\n' +
                'Wir bedanken uns bei den Entwicklern für diese hilfreiche Bibliothek.\n' +
                'We thank the developers for this helpful library.\n\n' +
                'Axios wird unter der MIT-Lizenz bereitgestellt.\n' +
                'Axios is provided under the MIT license.'
        },
        svgRepo: {
            title: 'Danksagungen / Acknowledgements',
            message: 'Diese App verwendet folgende Ressource:\nThis app uses the following resource:',
            detail:
                '- SVG Repo (https://www.svgrepo.com/):\n' +
                '  Eine umfangreiche Sammlung kostenloser SVG-Grafiken.\n' +
                '  A large collection of free SVG graphics.\n\n' +
                'Vielen Dank an die Community für die Bereitstellung dieser Ressourcen!\n' +
                'Thank you to the community for providing these resources!'
        },
        sheetjs: {
            title: 'Danksagungen / Acknowledgements',
            message: 'Diese App verwendet folgende Bibliothek:\nThis app uses the following library:',
            detail:
                '- SheetJS (https://sheetjs.com/):\n' +
                '  Eine weit verbreitete Bibliothek zum Lesen und Schreiben von Excel-Dateien.\n' +
                '  A widely-used library for reading and writing Excel files.\n\n' +
                'Wir danken den Entwicklern für diese leistungsstarke Open-Source-Bibliothek.\n' +
                'We thank the developers for this powerful open-source library.\n\n' +
                'SheetJS wird unter der Apache-2.0-Lizenz bereitgestellt.\n' +
                'SheetJS is provided under the Apache-2.0 license.'
        },
        deepseek: {
            title: 'Danksagungen / Acknowledgements',
            message: 'KI-Assistenz / AI Assistance',
            detail:
                '- DeepSeek (深度求索):\n' +
                '  Code-Refaktorisierung und Debugging-Unterstützung\n' +
                '  Code refactoring and debugging assistance\n\n' +
                'Vielen Dank für die Hilfe bei der Optimierung der Regel-Formular-Logik!\n' +
                'Thank you for the help optimizing the rule form logic!'
        },
        chatgpt: {
            title: 'Danksagungen / Acknowledgements',
            message: 'KI-Assistenz / AI Assistance',
            detail:
                '- ChatGPT:\n' +
                '  Unterstützung bei Architektur, Feature-Design und Konzeption\n' +
                '  Assistance with architecture, feature design, and conceptual guidance\n\n' +
                'Vielen Dank für die Hilfe bei der App-Architektur und den Funktionsideen!\n' +
                'Thank you for the help with app architecture and feature ideas!'
        },
        codex: {
            title: 'Danksagungen / Acknowledgements',
            message: 'KI‑Assistenz / AI Assistance',
            detail:
                '- Codex (OpenAI):\n' +
                '  Komplexes Debugging, Unterstützung über mehrere Skripte und Code‑Generierung\n' +
                '  Complex debugging, cross‑script support, and code generation\n\n' +
                'Vielen Dank für die Hilfe beim Refactoring und der Skript‑Integration!\n' +
                'Thank you for the help with refactoring and script integration!'
        }
    };

    const topicData = topics[topic];
    if (!topicData) return;

    dialog.showMessageBox(browserWindow, {
        type: 'info',
        title: topicData.title,
        message: topicData.message,
        detail: topicData.detail,
        buttons: ['OK']
    });
}

function buildMenuTemplate() {
    return [
        {
            label: 'Datei',
            submenu: [
                {
                    label: 'Daten Ordner öffnen',
                    click: async () => {
                        let folderPath = getClientDataFolder('client');

                        if (!folderPath || !fs.existsSync(folderPath)) {
                            folderPath = path.join(app.getPath('home'), 'mitarbeiterKalender', 'clientData');
                            fs.mkdirSync(folderPath, { recursive: true });

                            const markerPath = path.join(folderPath, '.mitarbeiterkalender');
                            if (!fs.existsSync(markerPath)) fs.writeFileSync(markerPath, 'home-folder-initialized');
                        }
                        let files;
                        try {
                            files = fs.readdirSync(folderPath);
                            if (files.length === 0) {
                                console.log('Folder is empty.');
                            } else {
                                console.log('Files in folder:', files);
                            }
                        } catch (err) {
                            console.error('Failed to read folder:', err);
                            files = [];
                        }

                        // Open folder in OS
                        if (process.platform === 'win32') {
                            const result = await shell.openPath(folderPath);
                            if (result) {
                                console.error('Error opening folder in Explorer:', result);
                                await dialog.showOpenDialog({ defaultPath: folderPath, properties: ['openDirectory'] });
                            }
                        } else {
                            exec(`xdg-open "${folderPath}"`, async (err) => {
                                if (err) {
                                    console.warn('xdg-open failed, opening fallback dialog.');
                                    await dialog.showOpenDialog({
                                        defaultPath: folderPath,
                                        properties: ['openDirectory', 'showHiddenFiles', 'multiSelections'],
                                        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
                                    });
                                }
                            });
                        }
                    }
                },
                {
                    label: 'Excel-Datei exportieren…',
                    click: async () => {
                        try {
                            const mod = await import('../excel/excelExport.js');
                            await mod.exportExcelFile(mainWindow);
                        } catch (err) {
                            console.error('Export menu error', err);
                            dialog.showErrorBox('Export Fehler', String(err));
                        }
                    }
                },
                {
                    label: 'Excel-Datei importieren…',
                    click: async () => {
                        try {
                            const mod = await import('../excel/excelImport.js');
                            await mod.importExcelFile(mainWindow);
                        } catch (err) {
                            console.error('Import menu error', err);
                            dialog.showErrorBox('Import Fehler', String(err));
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Excel-Vorlage erstellen…',
                    click: async () => {
                        try {
                            const mod = await import('../excel/excelTemplate.js');
                            // NEW function name:
                            const filePath = mod.buildTemplateToDownloads();
                        } catch (err) {
                            console.error('Template menu error', err);
                            dialog.showErrorBox('Vorlage Fehler', String(err));
                        }
                    }
                },
                {
                    label: 'App weitergeben…',
                    click: () => {
                        showShareAppDialog(mainWindow);
                    }
                },
                { label: 'Exit', role: 'quit' }
            ]
        },
        {
            label: 'Anzeige',
            submenu: [
                {
                    label: 'Aktualisieren',
                    accelerator: 'F5',
                    click: () => mainWindow.webContents.send('refresh-calendar')
                },
                {
                    label: 'Auto Zoom',
                    accelerator: 'Ctrl+Z',
                    click: () => autoAdjustZoom()
                },
                {
                    label: 'Feste Zoomstufe',
                    submenu: buildZoomSubmenu(),
                },
                { type: 'separator' },
                {
                    label: 'Farbschemata',
                    submenu: [
                        { label: 'Hell', click: () => sendThemeToRenderer('default') },
                        { label: 'Pastell', click: () => sendThemeToRenderer('pastel') },
                        { label: 'Dunkel', click: () => sendThemeToRenderer('dark') },
                        { label: 'Graustufen', click: () => sendThemeToRenderer('greyscale') },
                    ]
                },
                { type: 'separator' },
                {
                    label: 'Optik',
                    submenu: [
                        {
                            label: 'Schalter-Stil',
                            submenu: [
                                { label: 'Umschalter', type: 'radio', checked: true, click: () => sendPresenceUIMode('toggle') },
                                { label: 'Radio-Tasten', type: 'radio', click: () => sendPresenceUIMode('radio') },
                            ]
                        },
                        {
                            label: 'Schicht-Symbole',
                            submenu: [
                                { label: 'Leer', type: 'radio', checked: true, click: () => mainWindow.webContents.send('set-shift-symbols', 'empty') },
                                { label: 'Buchstaben', type: 'radio', click: () => mainWindow.webContents.send('set-shift-symbols', 'letters') },
                                { label: 'Emoji / Icons', type: 'radio', click: () => mainWindow.webContents.send('set-shift-symbols', 'emoji') }
                            ]
                        },
                        {
                            label: 'Sternzeichen',
                            submenu: [
                                { label: 'Versteckt', type: 'radio', checked: true, click: () => mainWindow.webContents.send('set-zodiac-style', 'none') },
                                { label: 'Astronomisch', type: 'radio', click: () => mainWindow.webContents.send('set-zodiac-style', 'symbol') },
                                { label: 'Bildlich', type: 'radio', click: () => mainWindow.webContents.send('set-zodiac-style', 'icon') }
                            ]
                        }

                    ]
                }
            ]
        },
        {
            label: 'Formulare',
            submenu: [
                {
                    label: 'Urlaub',
                    accelerator: 'CmdOrCtrl+U',
                    click: () => {
                        loadFormAndSendToRenderer('request-form', mainWindow.webContents);
                    }
                },
                {
                    label: 'Mitarbeiter',
                    accelerator: 'CmdOrCtrl+M',
                    click: () => {
                        loadFormAndSendToRenderer('employee-form', mainWindow.webContents);
                    }
                },
                {
                    label: 'Aufgaben',
                    accelerator: 'CmdOrCtrl+A',
                    click: () => {
                        loadFormAndSendToRenderer('role-form', mainWindow.webContents);
                    }
                },
                {
                    label: 'Regeln',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        loadFormAndSendToRenderer('rule-form', mainWindow.webContents);
                    }
                },
                {
                    label: 'Kalender',
                    accelerator: 'CmdOrCtrl+K',
                    click: () => {
                        loadFormAndSendToRenderer('calendar-form', mainWindow.webContents);
                    }
                },
                {
                    label: 'Werkzeuge',
                    accelerator: 'CmdOrCtrl+W',
                    click: () => {
                        loadFormAndSendToRenderer('admin-form', mainWindow.webContents);
                    }
                },
                {
                    label: 'Startseite',
                    accelerator: 'CmdOrCtrl+H',
                    click: () => {
                        loadFormAndSendToRenderer('welcome', mainWindow.webContents);
                    }
                },
            ]
        },
        {
            label: 'Hilfe',
            submenu: [
                {
                    label: 'Anleitung',
                    accelerator: 'f1',
                    click: () => mainWindow.webContents.send('open-help', 'anleitung')
                },
                {
                    label: 'Glossar',
                    accelerator: 'Ctrl+I',
                    click: () => mainWindow.webContents.send('open-help', 'chapter-glossar')
                },
                { type: 'separator' },
                {
                    label: 'Statusfeld',
                    accelerator: 'F11',
                    click: (menuItem, browserWindow) => {
                        showStatusPanel(browserWindow);
                    }
                },
                {
                    label: 'Konsole',
                    accelerator: 'F12',
                    click: (menuItem, browserWindow) => {
                        if (browserWindow) {
                            browserWindow.webContents.openDevTools();
                        } else {
                            console.log('No active window');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Lizenz',
                    click: (menuItem, browserWindow) => {
                        showLicenseDialog(browserWindow);
                    },
                },
                {
                    label: 'GitHub',
                    click: (menuItem, browserWindow) => {
                        showGitHubDialog(browserWindow);
                    },
                },
                {
                    label: 'Danksagungen',
                    submenu: [
                        {
                            label: 'open holiday api',
                            click: (menuItem, browserWindow) => {
                                showAcknowledgementsDialog(browserWindow, 'holidayApi');
                            }
                        },
                        {
                            label: 'electron',
                            click: (menuItem, browserWindow) => {
                                showAcknowledgementsDialog(browserWindow, 'electron');
                            }
                        },
                        {
                            label: 'axios',
                            click: (menuItem, browserWindow) => {
                                showAcknowledgementsDialog(browserWindow, 'axios');
                            }
                        },
                        {
                            label: 'SVG Repo',
                            click: (menuItem, browserWindow) => {
                                showAcknowledgementsDialog(browserWindow, 'svgRepo');
                            }
                        },
                        {
                            label: 'SheetJS',
                            click: (menuItem, browserWindow) => {
                                showAcknowledgementsDialog(browserWindow, 'sheetjs');
                            }
                        },
                        {
                            label: 'DeepSeek',
                            click: (menuItem, browserWindow) => {
                                showAcknowledgementsDialog(browserWindow, 'deepseek');
                            }
                        },
                        {
                            label: 'ChatGPT',
                            click: (menuItem, browserWindow) => {
                                showAcknowledgementsDialog(browserWindow, 'chatgpt');
                            }
                        },
                        {
                            label: 'Codex',
                            click: (menuItem, browserWindow) => {
                                showAcknowledgementsDialog(browserWindow, 'codex');
                            }
                        }

                    ]
                },
                {
                    label: `Version ${app.getVersion()}`,
                    enabled: false     // so it's just an info line
                }
            ]
        }
    ];
}

function addBackendLog(level, ...args) {
    const timestamp = new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(new Date());

    const message = args.map(arg => {
        if (typeof arg === 'string') return arg;

        try {
            return JSON.stringify(arg);
        } catch {
            return String(arg);
        }
    }).join(' ');

    backendLogs.push({
        timestamp,
        level,
        message
    });

    if (backendLogs.length > MAX_BACKEND_LOGS) {
        backendLogs.shift();
    }
}

export { createWindow };
