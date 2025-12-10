export interface ElectronAPI {
  isElectron: boolean;
  
  // File operations
  saveFile: (options: {
    defaultPath: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<{ canceled: boolean; filePath?: string }>;
  
  openFile: (options: {
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<{ canceled: boolean; filePath?: string }>;
  
  openProjectFile: () => Promise<{
    success: boolean;
    canceled?: boolean;
    filePath?: string;
    error?: string;
  }>;
  
  writeFile: (options: {
    filePath: string;
    content: string;
  }) => Promise<{ success: boolean; error?: string }>;
  
  readFile: (options: {
    filePath: string;
  }) => Promise<{ success: boolean; content?: string; error?: string }>;
  
  openExternalFile: (filePath: string) => Promise<{ 
    success: boolean; 
    content?: string; 
    filePath?: string;
    error?: string 
  }>;
  
  // Window operations
  closeWindow: () => Promise<void>;
  
  // Auto-updater functions
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<any>;
  restartAndUpdate: () => Promise<void>;
  simulateUpdate: () => Promise<any>;
  
  // Event listeners
  onCloseRequested: (callback: () => void) => () => void;
  
  onFileOpenRequest: (callback: (event: any, filePath: string) => void) => () => void;

  // Update event listeners
  onUpdateAvailable: (callback: (event: any, info: any) => void) => () => void;
  
  onUpdateDownloaded: (callback: (event: any, info: any) => void) => () => void;
  
  onUpdateError: (callback: (event: any, error: string) => void) => () => void;
  
  onDownloadProgress: (callback: (event: any, progress: any) => void) => () => void;

  onDownloadStarted: (callback: (event: any) => void) => () => void;

  // Menu event listeners
  onMenuNew: (callback: () => void) => () => void;
  
  onMenuOpen: (callback: () => void) => () => void;
  
  onMenuSave: (callback: () => void) => () => void;
  
  onMenuSaveAs: (callback: () => void) => () => void;
  
  onMenuPrint: (callback: () => void) => () => void;
  
  onMenuExportPDF: (callback: () => void) => () => void;
  
  onMenuQuit: (callback: () => void) => () => void;
  
  // Remove listeners
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};