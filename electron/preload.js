const { contextBridge, ipcRenderer } = require('electron');

// console.log('📌 Preload script loading...');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  // File operations
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  openProjectFile: () => ipcRenderer.invoke('file:open'),
  writeFile: (options) => ipcRenderer.invoke('file:write', options),
  readFile: (options) => ipcRenderer.invoke('file:read', options),
  openExternalFile: (filePath) => ipcRenderer.invoke('file:open-external', filePath),
  
  // Print operations
  printPDF: (options) => ipcRenderer.invoke('print:pdf', options),
  
  // Window operations
  closeWindow: () => ipcRenderer.invoke('window:close'),
  
  // Menu state updates
  updateMenuState: (isEnclosureSelected) => {
    ipcRenderer.invoke('app:update-menu-state', isEnclosureSelected);
  },
  
  // Development mode check
  isDevMode: () => ipcRenderer.invoke('app:is-dev-mode'),
  
  // Auto-updater functions
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  restartAndUpdate: () => ipcRenderer.invoke('app:restart-and-update'),
  simulateUpdate: () => ipcRenderer.invoke('test:simulate-update'),
  
  // Event listeners
  onCloseRequested: (callback) => {
    const handler = (event) => callback();
    ipcRenderer.on('window-close-requested', handler);
    return () => ipcRenderer.removeListener('window-close-requested', handler);
  },
  
  onFileOpenRequest: (callback) => {
    const handler = (event, filePath) => callback(event, filePath);
    ipcRenderer.on('file-open-request', handler);
    return () => ipcRenderer.removeListener('file-open-request', handler);
  },

  // Update event listeners
  onUpdateAvailable: (callback) => {
    const handler = (event, info) => callback(event, info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  
  onUpdateDownloaded: (callback) => {
    const handler = (event, info) => callback(event, info);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  
  onUpdateError: (callback) => {
    const handler = (event, error) => callback(event, error);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  },
  
  onDownloadProgress: (callback) => {
    const handler = (event, progress) => callback(event, progress);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },

  onDownloadStarted: (callback) => {
    const handler = (event) => callback(event);
    ipcRenderer.on('download-started', handler);
    return () => ipcRenderer.removeListener('download-started', handler);
  },

  // Menu action listeners - FIXED to handle menu-action events
  onMenuNew: (callback) => {
    const handler = (event, action) => {
      if (action === 'new') callback();
    };
    ipcRenderer.on('menu-action', handler);
    return () => ipcRenderer.removeListener('menu-action', handler);
  },
  
  onMenuOpen: (callback) => {
    const handler = (event, action) => {
      if (action === 'open') callback();
    };
    ipcRenderer.on('menu-action', handler);
    return () => ipcRenderer.removeListener('menu-action', handler);
  },
  
  onMenuSave: (callback) => {
    const handler = (event, action) => {
      if (action === 'save') callback();
    };
    ipcRenderer.on('menu-action', handler);
    return () => ipcRenderer.removeListener('menu-action', handler);
  },
  
  onMenuSaveAs: (callback) => {
    const handler = (event, action) => {
      if (action === 'save-as') callback();
    };
    ipcRenderer.on('menu-action', handler);
    return () => ipcRenderer.removeListener('menu-action', handler);
  },
  
  onMenuPrint: (callback) => {
    const handler = (event, action) => {
      if (action === 'print') callback();
    };
    ipcRenderer.on('menu-action', handler);
    return () => ipcRenderer.removeListener('menu-action', handler);
  },
  
  onMenuExportPDF: (callback) => {
    const handler = (event, action) => {
      if (action === 'export-pdf') callback();
    };
    ipcRenderer.on('menu-action', handler);
    return () => ipcRenderer.removeListener('menu-action', handler);
  },
  
  onMenuQuit: (callback) => {
    const handler = (event, action) => {
      if (action === 'quit') callback();
    };
    ipcRenderer.on('menu-action', handler);
    return () => ipcRenderer.removeListener('menu-action', handler);
  },
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});

// console.log('📌 Preload script loaded, electronAPI exposed');