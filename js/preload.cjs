const { contextBridge, ipcRenderer } = require('electron');
const crypto = require('crypto');

const validSendChannels = ['resize-event', 'load-form', 'return-cache-dump', 'update-cache'];
const validReceiveChannels = ['resize-response', 'form-loaded', 'set-theme', 'get-cache-dump', 'update-cache',
  'open-help', 'checklist-update', 'refresh-calendar', 'mode-changed',];
const validInvokeChannels = ['load-data', 'save-data', 'check-path', 'save-csv', 'get-recovered-path', 'set-cache-value',
  'get-cache-value', 'health-check', 'get-school-holidays'];

const CACHE_WHITELIST = [
  'colorTheme',
  'zoomFactor',
  'windowSize',
  'clientDataFolder',
  'autoSave',
];

const nonce = crypto.randomBytes(16).toString('base64');

contextBridge.exposeInMainWorld('security', {
  nonce: nonce
});


contextBridge.exposeInMainWorld('cacheAPI', {
  async getCacheValue(key) {
    if (!CACHE_WHITELIST.includes(key)) {
      console.warn(`⚠️ Attempt to access non-whitelisted key: ${key}`);
      return null;
    }
    return await ipcRenderer.invoke('get-cache-value', { key });
  },
  async setCacheValue(key, value) {
    if (!CACHE_WHITELIST.includes(key)) {
      console.warn(`⚠️ Attempt to set non-whitelisted key: ${key}`);
      return null;
    }
    return await ipcRenderer.invoke('set-cache-value', { key, value });
  },
});


contextBridge.exposeInMainWorld('api', {
  send: (channel, data) => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.error(`❌ Invalid channel: ${channel}`);
    }
  },
  checkPath: (homeKey, relativePath) => {
    return ipcRenderer.invoke('check-path', homeKey, relativePath);
  },
  onOpenInfo: (callback) => {
    ipcRenderer.on('open-info', (event, type) => {
      callback(type);
    });
  }, // <== ✅ COMMA ADDED HERE

  loadCSV: (homeKey, relativePath) => {
    return ipcRenderer.invoke('load-data', { homeKey, relativePath });
  },
  loadCSV: (homeKey, relativePath) => {
    return ipcRenderer.invoke('load-data', { homeKey, relativePath });
  },
  getRequestFiles: () => ipcRenderer.invoke("get-request-files"),
  getRecoveredPath: async () => {
    return ipcRenderer.invoke('get-recovered-path');
  },
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  healthCheck: (url) => ipcRenderer.invoke('health-check', url),
  getSchoolHolidays: (state, year) => ipcRenderer.invoke('get-school-holidays', state, year),
  onChecklistUpdate: (callback) => {
    const channel = 'download-checklist-update';
    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, step, status) => {
        callback(step, status);
      });
    }
  },
  saveCSV: async (homeKey, relativePath, csvContent) => {
    return await ipcRenderer.invoke('save-csv', homeKey, relativePath, csvContent);
  },
  showSaveStateDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  openExternalLink: (url) => {
    console.log(`♁ [Preload] Attempting to open URL: ${url}`);
    ipcRenderer.send('open-external', url);
  },
  loadForm: (formName) => {
    ipcRenderer.send('load-form', formName);
  },
  receive: (channel, func) => {
    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    } else {
      console.error(`✗ Invalid channel: ${channel}`);
    }
  },
  invoke: (channel, data) => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
  },
  removeListener: (channel, func) => {
    ipcRenderer.removeListener(channel, func);
  },
  saveSchoolCSV: (filePath, data) => ipcRenderer.invoke('save-school-csv', filePath, data),
});

contextBridge.exposeInMainWorld('electron', {
  onFormLoaded: (callback) => {
    ipcRenderer.on('form-loaded', (event, data) => {
      callback(event, data); // ← correctly pass both event and data
    });
  }
});

