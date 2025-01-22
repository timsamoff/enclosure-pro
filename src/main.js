const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

let win;

// Create the main window
function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadURL('index.html'); // Ensure that the main HTML file loads
}

// Menu template
const menuTemplate = [
  {
    label: 'App',
    submenu: [
      {
        label: 'Quit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit();
        }
      }
    ]
  },
  {
    label: 'File',
    submenu: [
      {
        label: 'New File',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
        }
      },
      {
        label: 'Open File',
        accelerator: 'CmdOrCtrl+O',
        click: () => {
        }
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      {
        label: 'Undo',
        accelerator: 'CmdOrCtrl+Z',
        role: 'undo'
      },
      {
        label: 'Redo',
        accelerator: 'Shift+CmdOrCtrl+Z',
        role: 'redo'
      },
      {
        type: 'separator'
      },
      {
        label: 'Cut',
        accelerator: 'CmdOrCtrl+X',
        role: 'cut'
      },
      {
        label: 'Copy',
        accelerator: 'CmdOrCtrl+C',
        role: 'copy'
      },
      {
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        role: 'paste'
      },
      {
        type: 'separator'
      },
      {
        label: 'Select All',
        accelerator: 'CmdOrCtrl+A',
        role: 'selectAll'
      },
      {
        type: 'separator'
      },
      {
        label: 'Settings',
        click: () => {
          createSettingsWindow();  // Open the Settings window
        }
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Toggle Grid',
        type: 'checkbox',
        checked: false,  // Default unchecked state
        click: (menuItem) => {
          // Toggle the grid visibility
          win.webContents.send('toggle-grid', menuItem.checked);
        }
      }
    ]
  },
  {
    label: 'Components',
    submenu: [
      {
        label: 'Other Component',
        click: () => {
          // Other components (temp)
        }
      }
    ]
  }
];

// Create application menu
const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

// Create settings window
function createSettingsWindow() {
  const settingsWin = new BrowserWindow({
    width: 400,
    height: 300,
    title: 'Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWin.loadFile('settings.html'); // Ensure settings.html is loaded
}

// Initialize app
app.whenReady().then(() => {
  createWindow();

  // Recreate window if closed
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
