const { Menu, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports.createMenu = ({ 
  createWindow, 
  saveProject, 
  saveProjectAs, 
  recentFiles, 
  saveRecentFiles
}) => {
  const isMac = process.platform === 'darwin';

  const template = [
    // File Menu
    {
      label: 'File',
      submenu: [
        { 
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => createWindow()
        },
        { type: 'separator' },
        { 
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleFileOpen(createWindow)
        },
        {
          label: 'Open Recent',
          submenu: createRecentFilesSubmenu(recentFiles, createWindow, saveRecentFiles)
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          id: 'saveProject',
          enabled: false,
          click: () => saveProject(BrowserWindow.getFocusedWindow())
        },
        {
          label: 'Save As...',
          accelerator: 'Shift+CmdOrCtrl+S',
          click: () => saveProjectAs(BrowserWindow.getFocusedWindow())
        },
        {
          label: 'Export PDF...',
          accelerator: 'CmdOrCtrl+E',
          click: handlePdfExport
        },
        { type: 'separator' },
        {
          label: 'Page Setup...',
          role: 'pageSetup', // Use Electron's built-in role
          accelerator: 'CmdOrCtrl+Shift+P'
        },
        {
          label: 'Print...',
          role: 'print', // Use Electron's built-in role
          accelerator: 'CmdOrCtrl+P'
        },
        { type: 'separator' },
        { 
          role: 'quit', 
          label: 'Exit',
          accelerator: isMac ? 'Cmd+Q' : 'Alt+F4'
        }
      ]
    },
    // Edit Menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' },
        { 
          role: 'delete', 
          label: 'Delete',
          accelerator: 'Delete'
        },
        { type: 'separator' },
        { 
          role: 'selectAll', 
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A'
        },
        { type: 'separator' },
        {
          label: 'Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.send('open-settings')
        }
      ]
    },
    // View Menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.setZoomLevel(0)
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => adjustZoom(0.2)
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => adjustZoom(-0.2)
        },
        { type: 'separator' },
        {
          label: 'Toggle Grid',
          type: 'checkbox',
          checked: false,
          accelerator: 'CmdOrCtrl+G',
          click: (menuItem) => BrowserWindow.getFocusedWindow()?.webContents.send('toggle-grid', menuItem.checked)
        }
      ]
    },
    // Components Menu
    {
      label: 'Components',
      submenu: [
        {
          label: 'Enclosures',
          accelerator: 'CmdOrCtrl+1',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.send('show-enclosures')
        },
        { type: 'separator' },
        {
          label: 'Components',
          accelerator: 'CmdOrCtrl+2',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.send('show-components')
        }
      ]
    },
    // Help Menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          accelerator: 'F1',
          click: () => shell.openExternal('https://your-docs-url')
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => dialog.showMessageBox({
            title: 'About Enclosure Pro',
            message: 'Enclosure Pro v1.0.0',
            detail: '© 2025 Tim Samoff (Circuitous FX)'
          })
        }
      ]
    }
  ];

  if (isMac) template.unshift(createMacAppMenu());
  return Menu.buildFromTemplate(template);

  function createMacAppMenu() {
    return {
      label: 'Enclosure Pro',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    };
  }

  function createRecentFilesSubmenu(recentFiles, createWindow, saveRecentFiles) {
    return [
      ...recentFiles.map(file => ({
        label: path.basename(file),
        click: () => createWindow(file)
      })),
      { type: 'separator' },
      {
        label: 'Clear Recent',
        click: () => {
          recentFiles.length = 0;
          saveRecentFiles();
          Menu.getApplicationMenu().getMenuItemById('openRecent').submenu.items = 
            Menu.buildFromTemplate(template)[0].submenu.items;
        }
      }
    ];
  }

  function handleFileOpen(createWindow) {
    dialog.showOpenDialog({
      filters: [{ name: 'Enclosure Pro Projects', extensions: ['epp'] }],
      properties: ['openFile']
    }).then(({ filePaths }) => {
      if (filePaths?.length) createWindow(filePaths[0]);
    }).catch(console.error);
  }

  function handlePdfExport() {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;

    win.webContents.printToPDF({})
      .then(data => {
        dialog.showSaveDialog({
          title: 'Export PDF',
          defaultPath: `export.pdf`,
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
        }).then(({ filePath }) => {
          if (filePath) fs.writeFileSync(filePath, data);
        }).catch(console.error);
      })
      .catch(err => {
        console.error('PDF export failed:', err);
        dialog.showErrorBox('Export Error', 'Failed to generate PDF');
      });
  }

  function adjustZoom(delta) {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      const currentZoom = win.webContents.getZoomLevel();
      win.webContents.setZoomLevel(currentZoom + delta);
    }
  }
};