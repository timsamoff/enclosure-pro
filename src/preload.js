const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Project Management
  getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),
  saveProject: (data) => ipcRenderer.send('save-project', data),
  loadProject: (callback) => ipcRenderer.on('load-project', callback),

  // UI Interactions
  toggleGrid: (callback) => ipcRenderer.on('toggle-grid', callback),
  showEnclosures: (callback) => ipcRenderer.on('show-enclosures', callback),
  showComponents: (callback) => ipcRenderer.on('show-components', callback),
  updateSaveState: (isSaved) => ipcRenderer.send('update-save-state', isSaved),

  // Settings
  openSettings: (callback) => ipcRenderer.on('open-settings', callback),

  // Error Handling
  onError: (callback) => ipcRenderer.on('error', callback)
});

// Security protections
process.once('loaded', () => {
  window.addEventListener('message', (evt) => {
    if (evt.data.type === 'ELECTRON::CALL') {
      const { method, args } = evt.data.payload;
      if (typeof window.electronAPI[method] === 'function') {
        window.electronAPI[method](...args);
      }
    }
  });
});