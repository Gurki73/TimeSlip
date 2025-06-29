import { app, BrowserWindow } from 'electron';
import { createWindow } from './main/appWindow.js';
import { registerEventHandlers } from './main/events.js';

const gotTheLock = app.requestSingleInstanceLock();


if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    const mainWindow = await createWindow();
    registerEventHandlers(mainWindow);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
