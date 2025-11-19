const { contextBridge, ipcRenderer } = require('electron');

// console.log('🔌 Preload script loading...');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  writeFile: (options) => ipcRenderer.invoke('file:write', options),
  readFile: (options) => ipcRenderer.invoke('file:read', options),
  openExternalFile: (filePath) => ipcRenderer.invoke('file:open-external', filePath),
  
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onCloseRequested: (callback) => {
    // console.log('📝 Setting up close request listener');
    ipcRenderer.on('window-close-requested', callback);
    return () => ipcRenderer.removeListener('window-close-requested', callback);
  },
  
  // Add file open event listener
  onFileOpenRequest: (callback) => {
    // console.log('📝 Setting up file open request listener in preload');
    ipcRenderer.on('file-open-request', callback);
    return () => {
      // console.log('🧹 Cleaning up file open request listener in preload');
      ipcRenderer.removeListener('file-open-request', callback);
    };
  }
});

// console.log('🔌 Preload script loaded, electronAPI exposed');