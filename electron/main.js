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

  // Set logger for debug output
  autoUpdater.logger = {
    info: (message) => console.log('🔍 AutoUpdater Info:', message),
    warn: (message) => console.log('⚠️ AutoUpdater Warn:', message),
    error: (message) => console.log('❌ AutoUpdater Error:', message),
    debug: (message) => console.log('🐛 AutoUpdater Debug:', message)
  };

  console.log('🔄 Auto-updater configured:', {
    autoDownload: autoUpdater.autoDownload,
    autoInstallOnAppQuit: autoUpdater.autoInstallOnAppQuit,
    allowPrerelease: autoUpdater.allowPrerelease,
    currentVersion: app.getVersion()
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...');
    mainWindow?.webContents.send('checking-for-update');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('✅ Update available:', info);
    mainWindow?.webContents.send('update-available', info);
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available! Would you like to download it now?`,
      detail: `Release notes: ${info.releaseName || 'Bug fixes and improvements'}`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        console.log('📥 User chose to download update');
        mainWindow?.webContents.send('download-started');
        autoUpdater.downloadUpdate();
      } else {
        console.log('⏰ User chose to download later');
      }
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('ℹ️ No updates available:', info);
    mainWindow?.webContents.send('update-not-available', info);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log('📊 Download progress:', Math.round(progressObj.percent) + '%');
    mainWindow?.webContents.send('download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('🎉 Update downloaded and ready to install:', info);
    mainWindow?.webContents.send('update-downloaded', info);
    
    // Force sync and show restart dialog
    setTimeout(() => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded and is ready to install.`,
        detail: 'The application will restart to complete the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1
      }).then((result) => {
        if (result.response === 0) {
          console.log('🔄 User chose to restart, calling quitAndInstall...');
          // isSilent = false (show install progress), isForceRunAfter = true (restart app)
          setImmediate(() => {
            autoUpdater.quitAndInstall(false, true);
          });
        } else {
          console.log('⏰ User chose to restart later');
        }
      });
    }, 100);
  });

  autoUpdater.on('error', (error) => {
    console.error('❌ Auto-updater error:', error);
    mainWindow?.webContents.send('update-error', error.message);
    
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Update Error',
      message: `Failed to update: ${error.message}`,
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
      devTools: true, // Enabled for production debugging
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

  // Add F12 shortcut to open DevTools (works in production too)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Prevent window from closing, let renderer handle it
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.webContents.send('window-close-requested');
  });

  // Handle window being destroyed
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

  // Check for updates 5 seconds after app starts
  setTimeout(() => {
    console.log('🚀 App started, checking for updates...');
    autoUpdater.checkForUpdates().then(result => {
      console.log('✅ Initial update check result:', result);
    }).catch(error => {
      console.error('❌ Initial update check failed:', error);
    });
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
  console.log('🔍 Manual update check via IPC');
  return autoUpdater.checkForUpdates();
});

ipcMain.handle('app:restart-and-update', () => {
  console.log('🔄 Manual restart and update via IPC');
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
});

ipcMain.handle('app:manual-check-updates', async () => {
  try {
    console.log('🔍 Manual update check requested via IPC');
    const result = await autoUpdater.checkForUpdates();
    console.log('✅ Manual update check result:', result);
    
    if (!result?.updateInfo) {
      return { 
        success: true, 
        updateAvailable: false,
        message: 'You are running the latest version.'
      };
    }
    
    return {
      success: true,
      updateAvailable: true,
      version: result.updateInfo.version
    };
  } catch (error) {
    console.error('❌ Manual update check failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// TEST: Simulate update handler
ipcMain.handle('test:simulate-update', () => {
  console.log('🎭 test:simulate-update IPC handler called');
  
  const currentVersion = app.getVersion();
  const nextVersion = getNextVersion(currentVersion);
  
  console.log(`🔧 Simulating update from ${currentVersion} to ${nextVersion}...`);
  
  mainWindow?.webContents.send('update-available', {
    version: nextVersion,
    releaseDate: new Date().toISOString()
  });
  
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
          
          setTimeout(() => {
            mainWindow?.webContents.send('update-downloaded', {
              version: nextVersion
            });
            
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

ipcMain.handle('file:open-external', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content, filePath };
  } catch (error) {
    console.error('Error reading external file:', error);
    return { success: false, error: error.message };
  }
});