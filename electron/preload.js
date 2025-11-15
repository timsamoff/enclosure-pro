const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  writeFile: (options) => ipcRenderer.invoke('file:write', options),
  readFile: (options) => ipcRenderer.invoke('file:read', options),
  isElectron: true,
});
