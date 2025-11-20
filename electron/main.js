const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;
let fileToOpen = null;
let isWindowReady = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Enclosure Pro',
    icon: path.join(__dirname, '../images/EnclosureProIcon.png'),
  });

  // Set up the Project menu with proper shortcuts
  setupProjectMenu();

  // Prevent window from closing, let renderer handle it
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.webContents.send('window-close-requested');
  });

  // Always load from built files (standalone Electron app)
  mainWindow.loadFile(path.join(__dirname, '../dist/public/index.html'));
  
  // When window is ready, check if there's a file to open
  mainWindow.webContents.once('did-finish-load', () => {
    isWindowReady = true;
    
    if (fileToOpen) {
      // Give React time to initialize
      setTimeout(() => {
        mainWindow.webContents.send('file-open-request', fileToOpen);
        fileToOpen = null;
      }, 1500);
    }
  });
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// Setup Project menu with proper shortcuts for each platform
function setupProjectMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    {
      label: 'Project',
      submenu: [
        {
          label: 'New',
          accelerator: isMac ? 'Cmd+N' : 'Ctrl+N',
          click: () => {
            mainWindow?.webContents.send('menu-new-file');
          }
        },
        {
          label: 'Open',
          accelerator: isMac ? 'Cmd+O' : 'Ctrl+O',
          click: async () => {
            try {
              const result = await dialog.showOpenDialog(mainWindow, {
                filters: [
                  { name: 'Enclosure Project Files', extensions: ['enc'] },
                  { name: 'All Files', extensions: ['*'] }
                ]
              });
              
              if (!result.canceled && result.filePaths.length > 0) {
                mainWindow?.webContents.send('file-open-request', result.filePaths[0]);
              }
            } catch (error) {
              console.error('Open failed:', error);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: isMac ? 'Cmd+S' : 'Ctrl+S',
          click: () => {
            mainWindow?.webContents.send('menu-save-file');
          }
        },
        {
          label: 'Save As',
          accelerator: isMac ? 'Cmd+Shift+S' : 'Ctrl+Shift+S',
          click: () => {
            mainWindow?.webContents.send('menu-save-as-file');
          }
        },
        { type: 'separator' },
        {
          label: 'Print',
          accelerator: isMac ? 'Cmd+P' : 'Ctrl+P',
          click: () => {
            mainWindow?.webContents.send('menu-print');
          }
        },
        {
          label: 'Export PDF',
          accelerator: isMac ? 'Cmd+E' : 'Ctrl+E',
          click: () => {
            mainWindow?.webContents.send('menu-export-pdf');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: isMac ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            // Send quit request to renderer to handle unsaved changes
            mainWindow?.webContents.send('window-close-requested');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Handle file open events (macOS)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  fileToOpen = filePath;
  
  if (mainWindow && isWindowReady) {
    mainWindow.webContents.send('file-open-request', filePath);
    fileToOpen = null;
  }
});

// Handle second instance (Windows/Linux)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      
      const filePath = getFilePathFromArgs(commandLine);
      if (filePath) {
        if (isWindowReady) {
          mainWindow.webContents.send('file-open-request', filePath);
        } else {
          fileToOpen = filePath;
        }
      }
    }
  });
}

app.whenReady().then(() => {
  const filePath = getFilePathFromArgs(process.argv);
  if (filePath) {
    fileToOpen = filePath;
  }
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Helper function to extract file path from command line arguments
function getFilePathFromArgs(args) {
  if (process.platform === 'win32') {
    const potentialFiles = args.slice(1).filter(arg => 
      arg.endsWith('.enc') && !arg.startsWith('--')
    );
    return potentialFiles[0] || null;
  } else if (process.platform === 'darwin') {
    return null;
  } else {
    const fileArg = args.find(arg => arg.endsWith('.enc') && !arg.startsWith('-'));
    return fileArg;
  }
}

// IPC handler to actually close the window (called after save check)
ipcMain.handle('window:close', () => {
  if (mainWindow) {
    mainWindow.destroy();
  }
});

// IPC Handlers for file operations
ipcMain.handle('dialog:saveFile', async (event, { defaultPath, filters }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: filters || [
      { name: 'Enclosure Project Files', extensions: ['enc'] },
      { name: 'All Files', extensions: ['*'] }
    ],
  });

  if (result.canceled) {
    return { canceled: true };
  }

  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('dialog:openFile', async (event, { filters }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [
      { name: 'Enclosure Project Files', extensions: ['enc'] },
      { name: 'All Files', extensions: ['*'] }
    ],
  });

  if (result.canceled) {
    return { canceled: true };
  }

  return { canceled: false, filePath: result.filePaths[0] };
});

ipcMain.handle('file:write', async (event, { filePath, content }) => {
  try {
    await fs.writeFile(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:read', async (event, { filePath }) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// New IPC handler for opening files from double-click
ipcMain.handle('file:open-external', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content, filePath };
  } catch (error) {
    console.error('Error reading external file:', error);
    return { success: false, error: error.message };
  }
});