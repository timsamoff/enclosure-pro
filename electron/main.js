const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { autoUpdater } = require('electron-updater');

let mainWindow;
let fileToOpen = null;
let isWindowReady = false;

// Auto-updater setup
function setupAutoUpdater() {
  // Configure auto-updater for proper restart behavior
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    mainWindow?.webContents.send('update-available', info);
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available! Would you like to download it now?`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        mainWindow?.webContents.send('download-started');
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log('Download progress:', progressObj.percent);
    mainWindow?.webContents.send('download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    mainWindow?.webContents.send('update-downloaded', info);
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded. Restart the application to apply the update?`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        console.log('Quitting and installing update...');
        autoUpdater.quitAndInstall(true, true);
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

  setupAutoUpdater();

  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.webContents.send('window-close-requested');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, '../dist/public/index.html'));
  
  mainWindow.webContents.once('did-finish-load', () => {
    isWindowReady = true;
    
    if (fileToOpen) {
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
  app.quit();
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

// Helper function to calculate next version for simulation
function getNextVersion(currentVersion) {
  const parts = currentVersion.split('.');
  const lastPart = parseInt(parts[parts.length - 1]);
  parts[parts.length - 1] = (lastPart + 1).toString();
  return parts.join('.');
}

// IPC handler to actually close the window (called after save check)
ipcMain.handle('window:close', () => {
  if (mainWindow) {
    mainWindow.destroy();
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
  console.log('Restarting and updating application...');
  autoUpdater.quitAndInstall(true, true);
});

// TEST: Simulate update handler - FIXED WITH DYNAMIC VERSION
ipcMain.handle('test:simulate-update', () => {
  console.log('🎭 test:simulate-update IPC handler called');
  
  const currentVersion = app.getVersion();
  const nextVersion = getNextVersion(currentVersion);
  
  console.log(`🔧 Simulating update from ${currentVersion} to ${nextVersion}...`);
  
  // Simulate update-available event with dynamic version
  mainWindow?.webContents.send('update-available', {
    version: nextVersion,
    releaseDate: new Date().toISOString()
  });
  
  // Show the update available dialog
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'TEST - Update Available',
    message: `Simulated: Version ${nextVersion} is available! Would you like to download it now?`,
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
              version: nextVersion
            });
            
            // Show the restart dialog
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'TEST - Update Ready',
              message: `Simulated: Version ${nextVersion} has been downloaded. Would you like to restart to apply the update?`,
              buttons: ['Restart', 'Later'],
              defaultId: 0,
              cancelId: 1
            }).then((restartResult) => {
              if (restartResult.response === 0) {
                console.log('🔧 User chose to restart (simulation only - no actual restart)');
                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: 'TEST - Simulation Complete',
                  message: `In a real update, the app would now restart with version ${nextVersion}.`,
                  buttons: ['OK']
                });
              }
            });
          }, 1000);
        }
      }, 300);
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