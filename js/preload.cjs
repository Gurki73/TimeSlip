const { contextBridge, ipcRenderer } = require('electron');
const crypto = require('crypto');

const validSendChannels = ['resize-event', 'load-form', 'return-cache-dump', 'update-cache', 'refresh-calendar',
  'open-help', 'toggle-devtools'];
const validReceiveChannels = [
  'resize-response', 'form-loaded', 'set-theme', 'get-cache-dump',
  'update-cache', 'open-help', 'checklist-update', 'refresh-calendar',
  'mode-changed', 'set-presence-ui-mode',
  'excel-import-done', 'excel-import-error', 'excel-export-done', 'excel-export-error',
  'excel-template-done', 'excel-template-error'
];
const validInvokeChannels = [
  'load-data', 'save-data', 'check-path', 'save-csv', 'load-csv',  // <-- add here
  'get-recovered-path', 'set-cache-value', 'get-cache-value',
  'health-check', 'get-school-holidays'
];

const CACHE_WHITELIST = [
  'colorTheme',
  'zoomFactor',
  'windowSize',
  'clientDataFolder',
  'presenceUIMode',
  'autoSave',
  'presenceState',
  'zodiacStyle'
];

const nonce = crypto.randomBytes(16).toString('base64');

if (!window.security) {
  contextBridge.exposeInMainWorld('security', { nonce });
}

if (!window.cacheAPI) {
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
}

if (!window.api) {
  const resolveHomeKey = () => {
    const mode = localStorage.getItem('dataMode');
    if (mode === 'sample' || mode === 'client') return mode;
    return 'auto';
  };

  const saveCSV = async (folderPath, fileName, content) => {
    const homeKey = 'client';
    return await ipcRenderer.invoke('save-csv', { homeKey, folderPath, fileName, csvContent: content });
  };

  const loadCSV = async (homeKey, relativePath) => {
    // const homeKey = resolveHomeKey();
    return await ipcRenderer.invoke('load-csv', { homeKey, relativePath });
  };

  const checkPath = async (relativePath) => {
    const homeKey = resolveHomeKey();
    return await ipcRenderer.invoke('check-path', { homeKey, relativePath });
  };

  contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => {
      if (validSendChannels.includes(channel)) ipcRenderer.send(channel, data);
      else console.error(`❌ Invalid channel: ${channel}`);
    },
    receive: (channel, func) => {
      if (validReceiveChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      } else {
        console.error(`✗ Invalid channel: ${channel}`);
      }
    },
    invoke: (channel, data) => {
      if (validInvokeChannels.includes(channel)) return ipcRenderer.invoke(channel, data);
    },
    removeListener: (channel, func) => ipcRenderer.removeListener(channel, func),

    // CSV helpers
    saveCSV,
    loadCSV,
    checkPath,

    // other API functions
    getRequestFiles: () => ipcRenderer.invoke("get-request-files"),
    getRecoveredPath: () => ipcRenderer.invoke('get-recovered-path'),
    readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
    healthCheck: (url) => ipcRenderer.invoke('health-check', url),
    getSchoolHolidays: (state, year) => ipcRenderer.invoke('get-school-holidays', state, year),
    showSaveStateDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    openExternalLink: (url) => ipcRenderer.send('open-external', url),
    loadForm: (formName) => ipcRenderer.send('load-form', formName),
    saveSchoolCSV: (filePath, data) => ipcRenderer.invoke('save-school-csv', filePath, data),
  });
}

if (!window.electron) {
  contextBridge.exposeInMainWorld('electron', {
    onFormLoaded: (callback) => ipcRenderer.on('form-loaded', (event, data) => callback(event, data))
  });
}

window.addEventListener('DOMContentLoaded', () => {
  window.dispatchEvent(new Event('api-ready'));
});

contextBridge.exposeInMainWorld('rulesAPI', {
  list: () => ipcRenderer.invoke('rules:list'),
  load: (relativePath) => ipcRenderer.invoke('rules:load', relativePath),
  save: (relativePath, content) => ipcRenderer.invoke('rules:save', relativePath, content),
  delete: (relativePath) => ipcRenderer.invoke('rules:delete', relativePath)
});
