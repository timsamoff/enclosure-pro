const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  writeFile: (options) => ipcRenderer.invoke('file:write', options),
  readFile: (options) => ipcRenderer.invoke('file:read', options),
  
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onCloseRequested: (callback) => {
    ipcRenderer.on('window-close-requested', callback);
    return () => ipcRenderer.removeListener('window-close-requested', callback);
  }
});