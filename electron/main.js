const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { autoUpdater } = require('electron-updater');

let mainWindow;
let fileToOpen = null;
let isWindowReady = false;

// Auto-updater setup
function setupAutoUpdater() {
  // Don't auto-download, let user control it
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    // Notify renderer that an update is available
    mainWindow?.webContents.send('update-available', info);
    
    // Ask user if they want to download
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available! Would you like to download it now?`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        // Notify renderer that download is starting
        mainWindow?.webContents.send('download-started');
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log('Download progress:', progressObj.percent);
    // Send progress to renderer
    mainWindow?.webContents.send('download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    // Notify renderer that update is ready
    mainWindow?.webContents.send('update-downloaded', info);
    
    // Ask user to restart
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded. Restart the application to apply the update?`,
      buttons: ['Restart', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error);
    mainWindow?.webContents.send('update-error', error.message);
  });
}

// Check for updates function
function checkForUpdates() {
  autoUpdater.checkForUpdates().then(result => {
    if (!result?.updateInfo) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'No Updates',
        message: 'You are running the latest version of Enclosure Pro.',
        buttons: ['OK']
      });
    }
  }).catch(error => {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Update Check Failed',
      message: `Failed to check for updates: ${error.message}`,
      buttons: ['OK']
    });
  });
}

function createWindow() {
  const isDevelopment = process.env.NODE_ENV === 'development';

  //const isDevelopment = true;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: isDevelopment,
    },
    title: 'Enclosure Pro',
    icon: path.join(__dirname, '../images/EnclosureProIcon.png'),
    autoHideMenuBar: true,
  });

  // Set up auto-updater
  setupAutoUpdater();

  // Only open DevTools in development
  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }

  // Prevent window from closing, let renderer handle it
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.webContents.send('window-close-requested');
  });

  // Handle window being destroyed
  mainWindow.on('closed', () => {
    mainWindow = null;
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
}

// Handle file open events (macOS)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  
  if (mainWindow && isWindowReady) {
    mainWindow.webContents.send('file-open-request', filePath);
  } else {
    fileToOpen = filePath;
  }
});

// Handle second instance (Windows/Linux)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      
      // Check for file path in command line
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
  // Check for file path in initial launch (Windows/Linux)
  const filePath = getFilePathFromArgs(process.argv);
  if (filePath) {
    fileToOpen = filePath;
  }
  
  createWindow();

  // Check for updates 5 seconds after app starts
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, quit the app when all windows are closed
  app.quit();
});

// Helper function to extract file path from command line arguments
function getFilePathFromArgs(args) {
  if (process.platform === 'win32') {
    // On Windows, look for .enc files in all arguments
    const potentialFiles = args.slice(1).filter(arg => 
      arg.endsWith('.enc') && !arg.startsWith('--')
    );
    return potentialFiles[0] || null;
  } else if (process.platform === 'darwin') {
    // macOS - we use the 'open-file' event instead
    return null;
  } else {
    // Linux - look for .enc files in arguments
    const fileArg = args.find(arg => arg.endsWith('.enc') && !arg.startsWith('-'));
    return fileArg;
  }
}

// IPC handler to actually close the window (called after save check)
ipcMain.handle('window:close', () => {
  if (mainWindow) {
    mainWindow.destroy();
    // After destroying the window, quit the app
    app.quit();
  }
});

// IPC handlers for auto-updater
ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

ipcMain.handle('app:check-for-updates', () => {
  return autoUpdater.checkForUpdates();
});

ipcMain.handle('app:restart-and-update', () => {
  autoUpdater.quitAndInstall();
});

// TEST: Simulate update handler - ALWAYS ALLOW FOR TESTING
ipcMain.handle('test:simulate-update', () => {
  console.log('🎭 test:simulate-update IPC handler called');
  
  // Always allow simulation for testing (remove the development check)
  console.log('🔧 Simulating update available...');
  
  // Simulate update-available event
  mainWindow?.webContents.send('update-available', {
    version: '1.0.1',
    releaseDate: new Date().toISOString()
  });
  
  // Show the update available dialog
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'TEST - Update Available',
    message: 'Simulated: Version 1.0.1 is available! Would you like to download it now?',
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      console.log('🔧 User chose to download update');
      
      // Simulate download progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        console.log(`🔧 Download progress: ${progress}%`);
        
        mainWindow?.webContents.send('download-progress', {
          percent: progress,
          bytesPerSecond: 1000000,
          total: 50000000,
          transferred: progress * 500000
        });
        
        if (progress >= 100) {
          clearInterval(interval);
          console.log('🔧 Download complete, simulating update downloaded');
          
          // Simulate update downloaded
          setTimeout(() => {
            mainWindow?.webContents.send('update-downloaded', {
              version: '1.0.1'
            });
            
            // Show the restart dialog
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'TEST - Update Ready',
              message: 'Simulated: Update downloaded. Would you like to restart to apply the update?',
              buttons: ['Restart', 'Later'],
              defaultId: 0,
              cancelId: 1
            }).then((restartResult) => {
              if (restartResult.response === 0) {
                console.log('🔧 User chose to restart (simulation only - no actual restart)');
                // In simulation, we don't actually restart
                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: 'TEST - Simulation Complete',
                  message: 'In a real update, the app would now restart with the new version.',
                  buttons: ['OK']
                });
              }
            });
          }, 1000);
        }
      }, 300); // Slower progress for better visibility
    }
  });
  
  return { success: true, message: 'Update simulation started' };
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

// IPC handler for opening files from double-click
ipcMain.handle('file:open-external', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content, filePath };
  } catch (error) {
    console.error('Error reading external file:', error);
    return { success: false, error: error.message };
  }
});