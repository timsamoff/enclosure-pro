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

  // Remove the system menu bar
  Menu.setApplicationMenu(null);

  // Prevent window from closing, let renderer handle it
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.webContents.send('window-close-requested');
  });

  // Always load from built files (standalone Electron app)
  mainWindow.loadFile(path.join(__dirname, '../dist/public/index.html'));
  
  // When window is ready, check if there's a file to open
  mainWindow.webContents.once('did-finish-load', () => {
    // console.log('🎯 Window finished loading, window is ready');
    isWindowReady = true;
    
    if (fileToOpen) {
      // console.log('📁 Found file to open from startup:', fileToOpen);
      // Give React time to initialize
      setTimeout(() => {
        // console.log('🚀 Sending file-open-request for startup file');
        mainWindow.webContents.send('file-open-request', fileToOpen);
        fileToOpen = null;
      }, 1500);
    }
  });
  
  // Open DevTools in development to see logs
  // mainWindow.webContents.openDevTools();

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
}
}

// Handle file open events (macOS)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  // console.log('📂 macOS open-file event received:', filePath);
  
  if (mainWindow && isWindowReady) {
    // console.log('✅ Window is ready, sending file-open-request immediately');
    mainWindow.webContents.send('file-open-request', filePath);
  } else {
    // console.log('⏳ Window not ready yet, storing file path for later');
    fileToOpen = filePath;
    
    // If app is still starting, we might need to create the window
    if (!mainWindow) {
      // console.log('🔄 No main window, will create one');
      // The window will be created in whenReady and will pick up fileToOpen
    }
  }
});

// Handle second instance (Windows/Linux)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // console.log('🔒 Another instance is running, quitting...');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // console.log('🔄 Second instance attempted with command line:', commandLine);
    
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      
      // Check for file path in command line
      const filePath = getFilePathFromArgs(commandLine);
      if (filePath) {
        // console.log('📁 File path from second instance:', filePath);
        if (isWindowReady) {
          // console.log('✅ Window ready, sending file-open-request');
          mainWindow.webContents.send('file-open-request', filePath);
        } else {
          // console.log('⏳ Window not ready, storing file path');
          fileToOpen = filePath;
        }
      }
    }
  });
}

app.whenReady().then(() => {
  // console.log('🚀 App is ready, process args:', process.argv);
  
  // Check for file path in initial launch (Windows/Linux)
  const filePath = getFilePathFromArgs(process.argv);
  if (filePath) {
    // console.log('📁 File path from initial launch:', filePath);
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
  // console.log('🔍 Processing args for file path:', args);
  
  if (process.platform === 'win32') {
    // On Windows, look for .enc files in all arguments
    // Skip the first argument (electron.exe or app path)
    const potentialFiles = args.slice(1).filter(arg => 
      arg.endsWith('.enc') && !arg.startsWith('--')
    );
    // console.log('💻 Windows potential files:', potentialFiles);
    return potentialFiles[0] || null;
  } else if (process.platform === 'darwin') {
    // macOS - we use the 'open-file' event instead
    return null;
  } else {
    // Linux - look for .enc files in arguments
    const fileArg = args.find(arg => arg.endsWith('.enc') && !arg.startsWith('-'));
    // console.log('🐧 Linux file arg found:', fileArg);
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
    // console.log('📖 Reading external file:', filePath);
    const content = await fs.readFile(filePath, 'utf8');
    // console.log('✅ File read successfully, length:', content.length);
    return { success: true, content, filePath };
  } catch (error) {
    console.error('❌ Error reading external file:', error);
    return { success: false, error: error.message };
  }
});