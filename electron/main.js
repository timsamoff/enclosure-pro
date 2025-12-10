const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { autoUpdater } = require('electron-updater');

let mainWindow;
let fileToOpen = null;
let isWindowReady = false;

// Create application menu with accelerators
function createApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const template = [
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: isMac ? 'Cmd+N' : 'Ctrl+N',
          click: () => {
            // console.log('🆕 New via accelerator');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu-action', 'new');
            }
          }
        },
        {
          label: 'Open Project...',
          accelerator: isMac ? 'Cmd+O' : 'Ctrl+O',
          click: () => {
            // console.log('📂 Open via accelerator');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu-action', 'open');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: isMac ? 'Cmd+S' : 'Ctrl+S',
          click: () => {
            // console.log('💾 Save via accelerator');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu-action', 'save');
            }
          }
        },
        {
          label: 'Save As...',
          accelerator: isMac ? 'Cmd+Shift+S' : 'Ctrl+Shift+S',
          click: () => {
            // console.log('💾 Save As via accelerator');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu-action', 'save-as');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Print...',
          accelerator: isMac ? 'Cmd+P' : 'Ctrl+P',
          click: () => {
            // console.log('🖨️ Print via accelerator');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu-action', 'print');
            }
          }
        },
        {
          label: 'Export as PDF...',
          accelerator: isMac ? 'Cmd+E' : 'Ctrl+E',
          click: () => {
            // console.log('📄 Export PDF via accelerator');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu-action', 'export-pdf');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: isMac ? 'Cmd+Q' : 'Alt+F4',
          click: () => {
            // console.log('🚪 Quit via accelerator');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu-action', 'quit');
            }
          }
        }
      ]
    },
    // Edit menu (for standard shortcuts)
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    // View menu - Dev tools only in development
    {
      label: 'View',
      submenu: (function() {
        const submenu = [
          { role: 'reload' },
          { role: 'forceReload' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ];
        
        // Only add toggleDevTools in development
        if (isDevelopment) {
          // Insert toggleDevTools at position 2 (after forceReload, before separator)
          submenu.splice(2, 0, { role: 'toggleDevTools' });
        }
        
        return submenu;
      })()
    }
  ];

  // Add Window menu on macOS
  if (isMac) {
    template.push({
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Auto-updater setup
function setupAutoUpdater() {
  // Configure auto-updater for proper restart behavior
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  // Set logger for debug output
  autoUpdater.logger = {
    info: (message) => console.log('📝 AutoUpdater Info:', message),
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
    // console.log('🔍 Checking for updates...');
    mainWindow?.webContents.send('checking-for-update');
  });

  autoUpdater.on('update-available', (info) => {
    // console.log('✅ Update available:', info);
    mainWindow?.webContents.send('update-available', info);
    
    // Ensure mainWindow exists before showing dialog
    if (!mainWindow) return;
    
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
        // console.log('📥 User chose to download update');
        mainWindow?.webContents.send('download-started');
        autoUpdater.downloadUpdate();
      } else {
        // console.log('⏰ User chose to download later');
      }
    }).catch((error) => {
      console.error('❌ Error showing update dialog:', error);
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    // console.log('ℹ️ No updates available:', info);
    mainWindow?.webContents.send('update-not-available', info);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    // console.log('📊 Download progress:', Math.round(progressObj.percent) + '%');
    mainWindow?.webContents.send('download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    // console.log('🎉 Update downloaded and ready to install:', info);
    mainWindow?.webContents.send('update-downloaded', info);
    
    // Ensure mainWindow exists before showing dialog
    if (!mainWindow) return;
    
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
          // console.log('🔄 User chose to restart, calling quitAndInstall...');
          // isSilent = false (show install progress), isForceRunAfter = true (restart app)
          setImmediate(() => {
            autoUpdater.quitAndInstall(false, true);
          });
        } else {
          // console.log('⏰ User chose to restart later');
        }
      }).catch((error) => {
        console.error('❌ Error showing restart dialog:', error);
      });
    }, 100);
  });

  autoUpdater.on('error', (error) => {
    console.error('❌ Auto-updater error:', error);
    mainWindow?.webContents.send('update-error', error.message);
    
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Update Error',
        message: `Failed to update: ${error.message}`,
        buttons: ['OK']
      }).catch((err) => {
        console.error('Error showing error dialog:', err);
      });
    }
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
      devTools: isDevelopment, // Only enable devTools in development
      sandbox: true,
    },
    title: 'Enclosure Pro',
    icon: path.join(__dirname, '../images/EnclosureProIcon.png'),
    autoHideMenuBar: true,
    show: false,
  });

  // Prevent Alt from opening menu bar
  mainWindow.setAutoHideMenuBar(true);
  mainWindow.setMenuBarVisibility(false);

  // Create application menu with accelerators
  createApplicationMenu();
  
  // Set up auto-updater
  setupAutoUpdater();

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Only open dev tools in development
    if (isDevelopment) {
      mainWindow.webContents.openDevTools();
    }
  });

  // F12 shortcut for DevTools - only in development
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // F12 for DevTools - only in development
    if (input.key === 'F12') {
      if (isDevelopment) {
        mainWindow.webContents.toggleDevTools();
      }
      event.preventDefault(); // Always prevent F12 in production
      return;
    }
    
    // Prevent Alt key from opening menu (but allow Alt+F4)
    if (input.key === 'Alt' && input.type === 'keyDown') {
      event.preventDefault();
      return;
    }
  });

  // Prevent window from closing
  mainWindow.on('close', (e) => {
    e.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-close-requested');
    }
  });

  // Handle window being destroyed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window loading errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load window:', errorCode, errorDescription);
  });

  mainWindow.loadFile(path.join(__dirname, '../dist/public/index.html')).catch((error) => {
    console.error('Failed to load index.html:', error);
    dialog.showErrorBox('Load Error', `Failed to load application: ${error.message}`);
  });
  
  mainWindow.webContents.once('did-finish-load', () => {
    isWindowReady = true;
    // console.log('✅ Window is ready');
    
    if (fileToOpen) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          // console.log('📂 Opening queued file:', fileToOpen);
          mainWindow.webContents.send('file-open-request', fileToOpen);
        }
        fileToOpen = null;
      }, 1500);
    }
  });
}

// Handle file open events (macOS)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  // console.log('📂 macOS open-file event:', filePath);
  
  if (mainWindow && isWindowReady && !mainWindow.isDestroyed()) {
    // console.log('📂 Sending file-open-request to renderer:', filePath);
    mainWindow.webContents.send('file-open-request', filePath);
  } else {
    // console.log('📂 Window not ready yet, storing file path:', filePath);
    fileToOpen = filePath;
  }
});

// Handle second instance (Windows/Linux)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // console.log('📂 Second instance detected');
    
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      
      const filePath = getFilePathFromArgs(commandLine);
      if (filePath) {
        // console.log('📂 File from command line:', filePath);
        if (isWindowReady && !mainWindow.isDestroyed()) {
          // console.log('📂 Sending file-open-request to renderer:', filePath);
          mainWindow.webContents.send('file-open-request', filePath);
        } else {
          // console.log('📂 Window not ready yet, storing file path');
          fileToOpen = filePath;
        }
      }
    }
  });
}

app.whenReady().then(() => {
  // console.log('🚀 App is ready');
  
  const filePath = getFilePathFromArgs(process.argv);
  if (filePath) {
    // console.log('📂 Initial file from command line:', filePath);
    fileToOpen = filePath;
  }
  
  createWindow();

  // Check for updates 5 seconds after app starts
  setTimeout(() => {
    // console.log('🔄 Checking for updates...');
    autoUpdater.checkForUpdates().then(result => {
      // console.log('✅ Initial update check result:', result);
    }).catch(error => {
      console.error('❌ Initial update check failed:', error);
    });
  }, 5000);

  app.on('activate', () => {
    // console.log('🔵 App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((error) => {
  console.error('Failed to create window:', error);
  dialog.showErrorBox('Startup Error', `Failed to start application: ${error.message}`);
});

app.on('window-all-closed', () => {
  // console.log('👋 All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Helper function to extract file path from command line arguments
function getFilePathFromArgs(args) {
  if (!args || !Array.isArray(args)) return null;
  
  // console.log('📂 Processing args:', args);
  
  if (process.platform === 'win32') {
    const potentialFiles = args.slice(1).filter(arg => 
      arg && typeof arg === 'string' && arg.endsWith('.enc') && !arg.startsWith('--')
    );
    // console.log('📂 Windows potential files:', potentialFiles);
    return potentialFiles[0] || null;
  } else if (process.platform === 'darwin') {
    const potentialFiles = args.slice(1).filter(arg => 
      arg && typeof arg === 'string' && arg.endsWith('.enc')
    );
    // console.log('📂 macOS potential files:', potentialFiles);
    return potentialFiles[0] || null;
  } else {
    const fileArg = args.find(arg => 
      arg && typeof arg === 'string' && arg.endsWith('.enc') && !arg.startsWith('-')
    );
    // console.log('📂 Linux potential file:', fileArg);
    return fileArg || null;
  }
}

// IPC handler to actually close the window
ipcMain.handle('window:close', () => {
  // console.log('🚪 Closing window via IPC');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  app.quit();
});

// IPC handlers for auto-updater
ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

ipcMain.handle('app:check-for-updates', () => {
  // console.log('🔍 Manual update check via IPC');
  return autoUpdater.checkForUpdates();
});

ipcMain.handle('app:restart-and-update', () => {
  // console.log('🔄 Manual restart and update via IPC');
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
});

ipcMain.handle('app:manual-check-updates', async () => {
  try {
    // console.log('🔍 Manual update check requested via IPC');
    const result = await autoUpdater.checkForUpdates();
    // console.log('✅ Manual update check result:', result);
    
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

// FIXED: Direct file open handler with consistent return format
ipcMain.handle('file:open', async () => {
  // console.log('📂 file:open called from renderer');
  
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.error('❌ Main window not available');
    return { success: false, error: 'Main window not available' };
  }
  
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Enclosure Project Files', extensions: ['enc'] },
        { name: 'All Files', extensions: ['*'] }
      ],
    });

    if (result.canceled) {
      return { 
        success: false, 
        canceled: true 
      };
    }

    const filePath = result.filePaths[0];
    // console.log('📂 Selected file (file:open):', filePath);
    
    // Send the file-open-request event for backward compatibility
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('file-open-request', filePath);
    }
    
    return { 
      success: true, 
      filePath 
    };
  } catch (error) {
    console.error('❌ Error in file:open:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Direct menu action triggers
ipcMain.handle('menu:new-project', () => {
  // console.log('🆕 Menu: New Project requested via IPC');
  if (mainWindow && isWindowReady && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-action', 'new');
  }
});

ipcMain.handle('menu:open-project', () => {
  // console.log('📂 Menu: Open Project requested via IPC');
  if (mainWindow && isWindowReady && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-action', 'open');
  }
});

ipcMain.handle('menu:save-project', () => {
  // console.log('💾 Menu: Save Project requested via IPC');
  if (mainWindow && isWindowReady && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-action', 'save');
  }
});

ipcMain.handle('menu:save-as-project', () => {
  // console.log('💾 Menu: Save As Project requested via IPC');
  if (mainWindow && isWindowReady && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-action', 'save-as');
  }
});

ipcMain.handle('menu:print-project', () => {
  // console.log('🖨️ Menu: Print Project requested via IPC');
  if (mainWindow && isWindowReady && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-action', 'print');
  }
});

ipcMain.handle('menu:export-pdf-project', () => {
  // console.log('📄 Menu: Export PDF requested via IPC');
  if (mainWindow && isWindowReady && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-action', 'export-pdf');
  }
});

ipcMain.handle('menu:quit-project', () => {
  // console.log('🚪 Menu: Quit requested via IPC');
  if (mainWindow && isWindowReady && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-action', 'quit');
  }
});

// IPC Handlers for file operations
ipcMain.handle('dialog:saveFile', async (event, { defaultPath, filters }) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { canceled: true, error: 'Main window not available' };
  }
  
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
  // console.log('📂 dialog:openFile called from renderer');
  
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.error('❌ Main window not available');
    return { canceled: true, error: 'Main window not available' };
  }
  
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || [
        { name: 'Enclosure Project Files', extensions: ['enc'] },
        { name: 'All Files', extensions: ['*'] }
      ],
    });

    // console.log('📂 Open dialog result:', result);

    if (result.canceled) {
      // console.log('📂 Open dialog was cancelled');
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    // console.log('📂 Selected file:', filePath);
    
    return { 
      canceled: false, 
      filePath
    };
  } catch (error) {
    console.error('❌ Error in dialog:openFile:', error);
    return { 
      canceled: true, 
      error: error.message 
    };
  }
});

ipcMain.handle('file:write', async (event, { filePath, content }) => {
  try {
    await fs.writeFile(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error writing file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:read', async (event, { filePath }) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    console.error('Error reading file:', error);
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

// TEST: Simulate update handler
ipcMain.handle('test:simulate-update', () => {
  // console.log('🎭 test:simulate-update IPC handler called');
  
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'Main window not available' };
  }
  
  const currentVersion = app.getVersion();
  const nextVersion = getNextVersion(currentVersion);
  
  // console.log(`🔧 Simulating update from ${currentVersion} to ${nextVersion}...`);
  
  mainWindow.webContents.send('update-available', {
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
      // console.log('🔧 User chose to download update');
      
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        // console.log(`🔧 Download progress: ${progress}%`);
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-progress', {
            percent: progress,
            bytesPerSecond: 1000000,
            total: 50000000,
            transferred: progress * 500000
          });
        }
        
        if (progress >= 100) {
          clearInterval(interval);
          // console.log('🔧 Download complete, simulating update downloaded');
          
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('update-downloaded', {
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
                  // console.log('🔧 User chose to restart (simulation only - no actual restart)');
                  dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'TEST - Simulation Complete',
                    message: `In a real update, the app would now restart with version ${nextVersion}.`,
                    buttons: ['OK']
                  });
                }
              });
            }
          }, 1000);
        }
      }, 300);
    }
  }).catch((error) => {
    console.error('Error in simulate update dialog:', error);
  });
  
  return { success: true, message: 'Update simulation started' };
});

// Helper function to calculate next version for simulation
function getNextVersion(currentVersion) {
  if (!currentVersion) return '1.0.0';
  
  const parts = currentVersion.split('.');
  if (parts.length < 3) return currentVersion + '.1';
  
  const lastPart = parseInt(parts[parts.length - 1]) || 0;
  parts[parts.length - 1] = (lastPart + 1).toString();
  return parts.join('.');
}

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});