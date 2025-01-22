const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  sendGridSettings: () => ipcRenderer.send('get-grid-settings'),
  updateGridSettings: (settings) => ipcRenderer.send('update-grid-settings', settings),
  onGridSettingsReceived: (callback) => ipcRenderer.on('send-grid-settings', callback),
  onGridSettingsUpdated: (callback) => ipcRenderer.on('grid-settings-updated', callback),
  onToggleGrid: (callback) => ipcRenderer.on('toggle-grid', callback)
});
