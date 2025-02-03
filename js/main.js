import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forcereload' },
      { role: 'toggledevtools' },  // ✅ DevTools menu item
      { type: 'separator' },
      { role: 'resetzoom' },
      { role: 'zoomin' },
      { role: 'zoomout' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }
];

let mainWindow;

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

  mainWindow.setTitle('Urlaubsplaner-App');

  try {
    await mainWindow.loadFile('index.html');
  } catch (error) {
    console.error('Error loading index.html:', error);
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (error) {
    console.error('Error creating window:', error);
  }
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
