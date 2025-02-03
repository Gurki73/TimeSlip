const { contextBridge, ipcRenderer } = require('electron');

const validSendChannels = ['resize-event', 'load-form'];
const validReceiveChannels = ['resize-response', 'form-loaded'];

contextBridge.exposeInMainWorld('api', {
  send: (channel, data) => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.error(`❌ Invalid channel: ${channel}`);
    }
  },
  getRequestFiles: () => ipcRenderer.invoke("get-request-files"),
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  getSchoolHolidays: (state, year) => ipcRenderer.invoke('get-school-holidays', state, year),
  saveCSV: (uniquePathName, uniqueFileName, csvContent) => ipcRenderer.send('save-csv', uniquePathName, uniqueFileName, csvContent),
  readStateFile: (filePath) => require('fs').promises.readFile(filePath, 'utf-8'),
  saveStateFile: (filePath, content) => require('fs').promises.writeFile(filePath, content, 'utf-8'),
  showSaveStateDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  loadForm: (formName) => {
    ipcRenderer.send('load-form', formName);
  },
  receive: (channel, func) => {
    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    } else {
      console.error(`❌ Invalid channel: ${channel}`);
    }
  },
  removeListener: (channel, func) => {
    ipcRenderer.removeListener(channel, func);
  },
  saveSchoolCSV: (filePath, data) => ipcRenderer.invoke('save-school-csv', filePath, data),
});

contextBridge.exposeInMainWorld('electron', {
  onFormLoaded: (callback) => ipcRenderer.on('form-loaded', callback),
});
