const { contextBridge, ipcRenderer } = require('electron');

// console.log('🔌 Preload script loading...');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  // File operations
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  writeFile: (options) => ipcRenderer.invoke('file:write', options),
  readFile: (options) => ipcRenderer.invoke('file:read', options),
  openExternalFile: (filePath) => ipcRenderer.invoke('file:open-external', filePath),
  
  // Window operations
  closeWindow: () => ipcRenderer.invoke('window:close'),
  
  // Auto-updater functions
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  restartAndUpdate: () => ipcRenderer.invoke('app:restart-and-update'),
  simulateUpdate: () => ipcRenderer.invoke('test:simulate-update'),
  
  // Event listeners
  onCloseRequested: (callback) => {
    ipcRenderer.on('window-close-requested', callback);
    return () => ipcRenderer.removeListener('window-close-requested', callback);
  },
  
  onFileOpenRequest: (callback) => {
    ipcRenderer.on('file-open-request', callback);
    return () => ipcRenderer.removeListener('file-open-request', callback);
  },

  // Update event listeners
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', callback);
    return () => ipcRenderer.removeListener('update-available', callback);
  },
  
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', callback);
    return () => ipcRenderer.removeListener('update-downloaded', callback);
  },
  
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', callback);
    return () => ipcRenderer.removeListener('update-error', callback);
  },
  
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', callback);
    return () => ipcRenderer.removeListener('download-progress', callback);
  },

  // NEW: Download started event
  onDownloadStarted: (callback) => {
    ipcRenderer.on('download-started', callback);
    return () => ipcRenderer.removeListener('download-started', callback);
  },

  // Menu event listeners for the native menu shortcuts
  onMenuNew: (callback) => ipcRenderer.on('menu-new-file', callback),
  onMenuOpen: (callback) => ipcRenderer.on('menu-open-file', callback),
  onMenuSave: (callback) => ipcRenderer.on('menu-save-file', callback),
  onMenuSaveAs: (callback) => ipcRenderer.on('menu-save-as-file', callback),
  onMenuPrint: (callback) => ipcRenderer.on('menu-print', callback),
  onMenuExportPDF: (callback) => ipcRenderer.on('menu-export-pdf', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});

// console.log('🔌 Preload script loaded, electronAPI exposed');