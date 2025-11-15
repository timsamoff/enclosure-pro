export interface ElectronAPI {
  saveFile: (options: {
    defaultPath: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<{ canceled: boolean; filePath?: string }>;
  
  openFile: (options: {
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<{ canceled: boolean; filePath?: string }>;
  
  writeFile: (options: {
    filePath: string;
    content: string;
  }) => Promise<{ success: boolean; error?: string }>;
  
  readFile: (options: {
    filePath: string;
  }) => Promise<{ success: boolean; content?: string; error?: string }>;
  
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
