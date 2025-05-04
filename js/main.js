import { app, BrowserWindow, ipcMain, Menu, dialog, shell, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';
import * as dataLoader from './main/clientDataLoader.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const gotTheLock = app.requestSingleInstanceLock();

const template = [
  {
    label: 'File',
    submenu: [
      { label: 'New', click: () => console.log('New File') },
      { label: 'Open', click: () => console.log('Open File') },
      { type: 'separator' },
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
        label: 'Auto Zoom',
        click: () => autoAdjustZoom()
      },
      {
        label: 'Feste Zoomstufe',
        submenu: [
          { label: '50%', click: () => mainWindow.webContents.setZoomFactor(0.50) },
          { label: '75%', click: () => mainWindow.webContents.setZoomFactor(0.75) },
          { label: '80%', click: () => mainWindow.webContents.setZoomFactor(0.80) },
          { label: '90%', click: () => mainWindow.webContents.setZoomFactor(0.90) },
          { label: '100%', click: () => mainWindow.webContents.setZoomFactor(1.00) },
          { label: '125%', click: () => mainWindow.webContents.setZoomFactor(1.25) },
        ]
      },
      { type: 'separator' },
      {
        label: 'Farbschemata',
        submenu: [
          { label: 'Hell', click: () => sendThemeToRenderer('default') },
          { label: 'Pastell', click: () => sendThemeToRenderer('pastel') },
          { label: 'Dunkel', click: () => sendThemeToRenderer('dark') },
        ]
      }
    ]
  }
];

let mainWindow;

function autoAdjustZoom() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;

  console.log('Screen size:', screen.getPrimaryDisplay().size);
  console.log('Work area size:', screen.getPrimaryDisplay().workAreaSize);

  if (width < 1000) {
    mainWindow.webContents.setZoomFactor(0.75);
  } else if (width < 1400) {
    mainWindow.webContents.setZoomFactor(0.90);
  } else {
    mainWindow.webContents.setZoomFactor(1.00);
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
  mainWindow = new BrowserWindow({
    width: 1800,
    height: 1000,
    fullscreen: false,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, '../js/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: false,
      devTools: true
    }
  });

  mainWindow.setTitle('Mitarbeiter Kalender');
  mainWindow.webContents.openDevTools();
  try {
    await mainWindow.loadFile('index.html');
  } catch (error) {
    console.error('Error loading index.html:', error);
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Optional: Focus existing window if another instance is launched
    if (BrowserWindow.getAllWindows().length > 0) {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await createWindow();
    } catch (error) {
      console.error('Error creating window:', error);
    }
  });
}

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

ipcMain.handle('save-file', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (err) {
    console.error('Error writing file:', err);
  }
});

ipcMain.on('app-close', () => {
  if (mainWindow) {
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

ipcMain.on('save-csv', (event, uniquePathName, uniqueFileName, csvContent) => {
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
  const csvContent = parseToCSV(data);
  try {
    await fs.promises.writeFile(filePath, csvContent, 'utf-8');
    console.log('CSV saved successfully');
  } catch (err) {
    console.error('Failed to write CSV:', err);
  }
});

ipcMain.handle("get-request-files", async () => {
  try {
    const directoryPath = path.join(__dirname, "../data/requests");
    const files = await fs.promises.readdir(directoryPath);

    return files
      .filter(file => file.match(/\d{4}_\d{2}_requests\.csv/))
      .map(file => path.join(directoryPath, file));
  } catch (error) {
    console.warn("🚨 Error reading directory:", error);
    return [];
  }
});

ipcMain.handle("read-file", async (_, filePath) => {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    console.warn("🚨 Error reading file:", error);
    return "";
  }
});

ipcMain.handle('get-school-holidays', async (event, state, year) => {
  console.log('main.js get-school was invoked ' + state + " & " + year);

  try {
    const filePath = `data/schoolHolidays/${state}_${year}_holidays.csv`;

    const response = await axios.get('https://openholidaysapi.org/SchoolHolidays', {
      params: {
        countryIsoCode: 'DE',
        validFrom: `${year}-01-01`,
        validTo: `${year}-12-31`,
        languageIsoCode: 'DE',
        subdivisionCode: state
      },
      headers: {
        'Accept': 'application/json'
      }
    });

    const holidaysData = parseToCSV(response.data);
    console.log(holidaysData);

    fs.writeFileSync(filePath, holidaysData, 'utf8');
    console.log(`✅ CSV gespeichert unter: ${filePath}`);

    return holidaysData;
  } catch (error) {
    console.error('❌ Error fetching holidays:', error);
    return [];
  }
});

ipcMain.handle('check-path', async (event, homeKey, relativePath) => {
  return dataLoader.checkPath(homeKey, relativePath);
});

function parseToCSV(data) {
  const header = 'Holiday Name,Start Date,End Date\n';
  const rows = data.map(holiday => {
    const name = holiday.name.map(n => n.text).join(', '); // Falls mehrere Namen vorhanden sind
    return `${name},${holiday.startDate},${holiday.endDate}`;
  }).join('\n');

  return header + rows;
}


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


ipcMain.on('load-form', (event, formName) => {

  const validForms = ['calendar-form', 'employee-form', 'request-form', 'role-form', 'rule-form', 'admin-form'];

  if (validForms.includes(formName)) {
    const formPath = path.join(__dirname, `../Components/forms/${formName}/${formName}.html`);
    fs.readFile(formPath, 'utf8', (err, data) => {
      if (err) {
        console.error(`❌ Error loading ${formName}:`, err);
        event.sender.send('form-loaded', { formName, htmlContent: `<p style="color:red;">Fehler beim Laden des Formulars.</p>` });
      } else {
        event.sender.send('form-loaded', { formName, htmlContent: data });
      }
    });
  } else {
    event.sender.send('form-loaded', { formName, htmlContent: `<p style="color:red;">Ungültiges Formular.</p>` });
  }
});

