import { app, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import axios from 'axios';
import { inMemoryCache, updateInMemoryCache } from './shared.js';
import * as dataLoader from './dataIO.js';
import { getMainWindow } from './appWindow.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function registerEventHandlers(mainWindow) {
    ipcMain.handle('get-recovered-path', async () => {
        // Implement logic to scan for data folders and return best candidate path or null
        const recoveredPath = await dataLoader.scanForDataFolders();
        return recoveredPath;
    });

    ipcMain.handle('show-save-dialog', async (event, suggestedName) => {
        const defaultPath = path.join(__dirname, '..', 'data', suggestedName);

        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Save CSV File',
            defaultPath: defaultPath,  // Suggest the default file path with preselected folder
            filters: [
                { name: 'CSV Files', extensions: ['csv'] }
            ],
        });

        if (result.canceled) {
            return null;
        }
        return result.filePath;  // Return the chosen file path
    });

    ipcMain.handle('save-csv', async (event, { homeKey, folderPath, fileName, csvContent }) => {
        if (homeKey === 'sample') return 'Beispiel kann nicht überschrieben werden';
        try {
            const savedPath = await dataLoader.saveCSV('client', folderPath, fileName, csvContent);
            return path.dirname(savedPath); // return folder path for caching
        } catch (err) {
            console.error('❌ Error saving CSV:', err);
            return null;
        }
    });

    ipcMain.on('switch-mode', (event, targetMode) => {

        if (!['sandbox', 'real'].includes(targetMode)) {
            console.warn('⚠ Invalid mode:', targetMode);
            return;
        }

        inMemoryCache.currentMode = targetMode;
        console.log(`⟳ Mode switched → ${targetMode}`);

        const mainWindow = getMainWindow();
        if (mainWindow) {
            // Update title based on mode
            const newTitle = targetMode === 'sandbox'
                ? 'Mitarbeiter-Kalender (Lern-Modus)'
                : 'Mitarbeiter-Kalender';
            mainWindow.setTitle(newTitle);

            // Notify renderer for purple border etc
            mainWindow.webContents.send('mode-changed', targetMode);
        }
    });


    ipcMain.on('app-close', async () => {
        if (!mainWindow) return;

        if (inMemoryCache.unsavedChanges) {
            const { response } = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                buttons: ['Save & Quit', 'Quit Without Saving', 'Cancel'],
                defaultId: 0,
                cancelId: 2,
                title: 'Unsaved Changes',
                message: 'You have unsaved changes. What do you want to do?',
            });

            if (response === 0) {
                // 🔜 Placeholder: trigger save routine
                console.log('💾 Saving before quit (TODO)');
                mainWindow.close();
            } else if (response === 1) {
                console.log('⚠️ Quit without saving');
                mainWindow.close();
            } else {
                console.log('❌ Cancel quit');
                return;
            }
        } else {
            mainWindow.close();
        }
    });


    ipcMain.on('open-external', async (event, url) => {
        if (!app.isReady()) {
            console.error("❌ Electron app is not ready yet!");
            return;
        }

        console.log("🚀 Opening external URL:", url);
        try {
            await shell.openExternal(url);
            console.log("✅ Successfully opened external link.");
        } catch (error) {
            console.error("❌ Failed to open external link:", error);
        }
    });

    ipcMain.on('resize-event', (event, data) => {
        console.log('Resize event received in main process:', data);
        event.sender.send('resize-response', { success: true });
    });

    ipcMain.on('save-settings', (event, uniquePathName, uniqueFileName, csvContent) => {
        fs.mkdir(uniquePathName, { recursive: true }, (err) => {
            if (err) {
                console.error('❌ Error creating directory:', err);
                return;
            }

            const completePath = path.join(uniquePathName, uniqueFileName);

            fs.writeFile(completePath, csvContent, 'utf8', (err) => {
                if (err) {
                    console.error('❌ Error saving file:', err);
                } else {
                    console.log(`✅ File saved successfully at ${completePath}`);
                }
            });
        });
    });

    ipcMain.handle('save-school-csv', async (event, filePath, data) => {
        const csvContent = dataLoader.parseToCSV(data);
        try {
            await fs.promises.writeFile(filePath, csvContent, 'utf-8');
            console.log('CSV saved successfully');
        } catch (err) {
            console.error('Failed to write CSV:', err);
        }
    });

    ipcMain.handle('rules:list', (event) => {
        return dataLoader.listRuleFiles(inMemoryCache.dataMode || 'auto');
    });

    ipcMain.handle('rules:load', (event, relativePath) => {
        return dataLoader.loadRuleFile(inMemoryCache.dataMode || 'auto', relativePath);
    });

    ipcMain.handle('rules:save', (event, relativePath, content) => {
        return dataLoader.saveRuleFile(inMemoryCache.dataMode || 'client', relativePath, content);
    });

    ipcMain.handle('rules:delete', (event, relativePath) => {
        return dataLoader.deleteRuleFile(inMemoryCache.dataMode || 'client', relativePath);
    });

    ipcMain.handle("get-request-files", async () => {
        try {
            const clientFolder = dataLoader.getClientDataFolder('client');
            if (!clientFolder) {
                console.warn('⚠️ Client data folder not found, returning empty array.');
                return [];
            }

            const requestsFolder = path.join(clientFolder, 'requests');
            if (!fs.existsSync(requestsFolder)) {
                console.warn(`⚠️ Requests folder does not exist: ${requestsFolder}`);
                return [];
            }

            const files = await fs.promises.readdir(requestsFolder);
            console.log("files in dir", files);
            const validFiles = files
                .filter(file => /^\d{4}_requests\.csv$/.test(file)) // match year_requests.csv
                .map(file => path.join(requestsFolder, file));

            console.log("[ events ]  valid request files:", validFiles);
            return validFiles;

        } catch (error) {
            console.warn('⚠️ Error reading request files:', error);
            return [];
        }
    });


    ipcMain.handle("read-file", async (_, filePath) => {
        console.log(" READ FILE");
        dataLoader.loadCSV(filePath);
    });
    /*
    ipcMain.handle('get-school-holidays', async (event, state, year) => {
        console.log('main.js get-school was invoked ' + state + " & " + year);

        try {
            const filePath = `schoolHolidays/${state}_${year}_holidays.csv`;

            const response = await axios.get('https://openholidaysapi.org/SchoolHolidays', {
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
            console.log('📦 Full API response data:', response.data);
            const holidaysData = dataLoader.parseToCSV(response.data);
            console.log(holidaysData);

            fs.writeFileSync(filePath, holidaysData, 'utf8');
            console.log(`✅ CSV gespeichert unter: ${filePath}`);

            return holidaysData;
        } catch (error) {
            console.error('❌ Error fetching holidays:', error);
            return [];
        }
    });
    */
    ipcMain.handle('get-school-holidays', async (event, state, year) => {
        console.log('main.js get-school was invoked ' + state + " & " + year);
        return await dataLoader.downloadSchoolHolidays(state, year, event);
    });

    ipcMain.handle('check-path', async (event, homeKey, relativePath) => {
        return dataLoader.checkPath(homeKey, relativePath);
    });
    ipcMain.handle('health-check', async (event, url) => {
        try {
            const response = await axios.head(url, {
                timeout: 3000,
                validateStatus: () => true  // Let us handle all responses manually
            });

            const status = response.status;

            // Treat everything under 500 as "reachable"
            const isReachable = status < 500;

            return {
                success: isReachable,
                status,
                message: isReachable ? 'OK' : `Server error: ${status}`
            };

        } catch (error) {
            console.error('❌ Network or fetch error:', error.message);
            return {
                success: false,
                message: `Network error: ${error.message}`
            };
        }
    });

    ipcMain.on('load-form', (event, formName) => {
        loadFormAndSendToRenderer(formName, event.sender);
    });
    ipcMain.on('refresh-calendar', () => {
        mainWindow.webContents.send('refresh-calendar');
    });

    ipcMain.on('toggle-devtools', () => {
        mainWindow.webContents.toggleDevTools();
    });


    ipcMain.handle('load-csv', async (event, { homeKey, relativePath }) => {
        try {
            const content = await dataLoader.loadCSV(homeKey, relativePath);
            return content;
        } catch (err) {
            console.error(`❌ Failed load-csv for ${relativePath}:`, err);
            throw err;
        }
    });


    ipcMain.handle('get-cache-value', async (event, { key }) => {
        const value = inMemoryCache[key] ?? null;
        console.log(`🔍 Cache Read: ${key} →`, value);
        return value;
    });

    ipcMain.handle('set-cache-value', async (event, { key, value }) => {
        console.log(`🧠 Set cache [${key}] =`, value);
        inMemoryCache[key] = value;
        return true;
    });
}

export function loadFormAndSendToRenderer(formName, webContents) {
    const validForms = ['calendar-form', 'employee-form', 'request-form', 'role-form', 'rule-form', 'admin-form'];

    if (!validForms.includes(formName)) {
        webContents.send('form-loaded', {
            formName,
            htmlContent: `<p class="text-red">Ungültiges Formular.</p>`
        });
        return;
    }

    const installDir = app.getAppPath();
    const formPath = path.join(installDir, 'Components', 'forms', formName, `${formName}.html`);

    console.log("Resolved form path:", formPath);

    fs.readFile(formPath, 'utf8', (err, data) => {
        if (err) {
            console.error(`❌ Error loading ${formName}:`, err);
            webContents.send('form-loaded', {
                formName,
                htmlContent: `<p class="text-red">Fehler beim Laden des Formulars.</p>`
            });
        } else {
            webContents.send('form-loaded', { formName, htmlContent: data });
        }
    });
}

