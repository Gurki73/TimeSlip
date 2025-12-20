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

let mainWindow;

function autoAdjustZoom() {
    const { width } = screen.getPrimaryDisplay().workAreaSize;

    if (width < 1400) {
        mainWindow.webContents.setZoomFactor(0.75);
    } else if (width < 1600) {
        mainWindow.webContents.setZoomFactor(0.8);
    } else if (width < 1920) {
        mainWindow.webContents.setZoomFactor(1.0);
    } else {
        mainWindow.webContents.setZoomFactor(1.15);
    }
}

function sendThemeToRenderer(themeName) {
    const focusedWindow = BrowserWindow.getFocusedWindow();

    if (focusedWindow) {
        console.log(`[Theme] Sending theme "${themeName}" to renderer`);
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
        console.log('🧩 Safe mode active → skipping normal renderer');
        await mainWindow.loadURL('data:text/html,<h1>🧩 Safe Mode Active</h1><p>No preload, no renderer</p>');
        return mainWindow;
    }

    try {
        await mainWindow.loadFile('./index.html');
    } catch (error) {
        console.error('Error loading index.html:', error);
    }


    const template = [
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
                            console.log('Template created at:', filePath);
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
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'copy' },
                { role: 'paste' }
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
                    submenu: [
                        {
                            label: '50%',
                            accelerator: 'Ctrl+1',
                            click: () => mainWindow.webContents.setZoomFactor(0.50)
                        },

                        {
                            label: '75%',
                            accelerator: 'Ctrl+2',
                            click: () => mainWindow.webContents.setZoomFactor(0.75)
                        },
                        {
                            label: '80%',
                            accelerator: 'Ctrl+3',
                            click: () => mainWindow.webContents.setZoomFactor(0.80)
                        },
                        {
                            label: '90%',
                            accelerator: 'Ctrl+4',
                            click: () => mainWindow.webContents.setZoomFactor(0.90)
                        },
                        {
                            label: '100%',
                            accelerator: 'Ctrl+0',
                            click: () => mainWindow.webContents.setZoomFactor(1.00)
                        },
                        {
                            label: '125%',
                            accelerator: 'Ctrl+5',
                            click: () => mainWindow.webContents.setZoomFactor(1.25)
                        },
                    ]
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
                {
                    label: 'Schalter-Stiel',
                    submenu: [
                        { label: 'Umschalter', type: 'radio', checked: true, click: () => sendPresenceUIMode('toggle') },
                        { label: 'Radio-Tasten', type: 'radio', click: () => sendPresenceUIMode('radio') },
                    ]
                },
                { type: 'separator' },
                {
                    label: 'Sternzeichen',
                    submenu: [
                        { label: 'versteckt', type: 'radio', checked: true, click: () => setZodiacStyle('none') },
                        { label: 'astronomisch', type: 'radio', click: () => setZodiacStyle('symbol') },
                        { label: 'bildlich', type: 'radio', click: () => setZodiacStyle('icon') }
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

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    return mainWindow;
}

export function getMainWindow() {
    return mainWindow;
}

async function setZodiacStyle(style) {
    await window.cacheAPI.setCacheValue('zodiacStyle', style);
    window.api.send('refresh-calendar');
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

    let message;
    if (Object.keys(inMemoryCache).length === 0) {
        message = 'Cache is empty.';
    } else {
        message = Object.entries(inMemoryCache)
            .map(([key, value]) => `${key}: ${value || 'Not set'}`)
            .join('\n');
    }

    const now = new Date();
    const formattedTime = new Intl.DateTimeFormat('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).format(now);

    dialog.showMessageBox(browserWindow, {
        type: 'info',
        title: 'Statusfeld',
        message: `App version: ${version}\nStatus am ${formattedTime}`,
        detail: message,
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
            message: 'Diese App verwendet folgende Technologie\nThis app uses the following technologie:',
            detail:
                '- Electron (https://www.electronjs.org/):\n' +
                '  Ein Framework zum Erstellen plattformübergreifender Desktop-Apps mit Web-Technologien.\n' +
                '  A framework for building cross-platform desktop apps using web technologies.\n\n' +
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

export { createWindow };
