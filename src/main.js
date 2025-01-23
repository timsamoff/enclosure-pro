const { app, BrowserWindow, Menu, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

let windowCount = 0;
const untitledBaseName = 'Untitled';
const projectExtension = '.epp';

function createWindow(projectPath = null) {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  windowCount++;
  const untitledName = `${untitledBaseName} ${windowCount}`;
  win.projectPath = projectPath;
  win.isSaved = projectPath ? true : false;

  if (projectPath) {
    win.setTitle(path.basename(projectPath));
    loadProjectData(win, projectPath);
  } else {
    win.setTitle(`${untitledName}*`);
  }

  positionNewWindow(win);

  win.on('close', (e) => {
    if (!win.isSaved) {
      const choice = dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['Save', 'Don’t Save', 'Cancel'],
        title: 'Unsaved Changes',
        message: `Do you want to save changes to ${win.getTitle().replace('*', '')}?`,
      });
      if (choice === 0) {
        saveProject(win);
      } else if (choice === 2) {
        e.preventDefault();
      }
    }
  });

  win.webContents.on('did-finish-load', () => {
    // Mark as saved when the project is loaded
    if (projectPath) {
      win.isSaved = true;
      win.setTitle(path.basename(projectPath));
      updateSaveMenu(win);
    }
  });

  win.loadFile('index.html');
}

function positionNewWindow(win) {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length > 1) {
    const prevBounds = allWindows[allWindows.length - 2].getBounds();
    win.setBounds({
      x: prevBounds.x + 10,
      y: prevBounds.y + 10,
      width: prevBounds.width,
      height: prevBounds.height,
    });
  } else {
    win.center();
  }
}

function saveProject(win) {
  if (!win.projectPath) {
    saveProjectAs(win);
  } else {
    saveProjectData(win, win.projectPath);
  }
}

function saveProjectAs(win) {
  const filePath = dialog.showSaveDialogSync(win, {
    filters: [{ name: 'Enclosure Pro Project', extensions: ['epp'] }],
    defaultPath: win.projectPath || `${untitledBaseName.toLowerCase()}${projectExtension}`,
  });

  if (filePath) {
    win.projectPath = filePath;
    saveProjectData(win, filePath);
  }
}

function saveProjectData(win, filePath) {
  const content = JSON.stringify({ data: 'Project Data Here' });
  fs.writeFileSync(filePath, content, 'utf8');
  win.isSaved = true;
  win.setTitle(path.basename(filePath));
  updateSaveMenu(win);
}

function loadProjectData(win, filePath) {
  if (!fs.existsSync(filePath)) return;

  const data = fs.readFileSync(filePath, 'utf8');
  win.webContents.send('load-project', JSON.parse(data));
  win.projectPath = filePath;

  // After loading, mark the project as saved
  win.isSaved = true;
  win.setTitle(path.basename(filePath));
  updateSaveMenu(win);
}

function updateSaveMenu(win) {
  const menu = Menu.getApplicationMenu();
  const saveItem = menu.getMenuItemById('saveProject');
  if (saveItem) saveItem.enabled = !win.isSaved;
}

app.on('ready', () => {
  const template = [
    {
      label: app.name,
      submenu: [
        { label: `About ${app.name}`, role: 'about' },
        { type: 'separator' },
        { label: `Quit ${app.name}`, role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          click: () => createWindow(),
          accelerator: 'CmdOrCtrl+N',
        },
        {
          label: 'Open Project',
          click: () => {
            const files = dialog.showOpenDialogSync({
              filters: [{ name: 'Enclosure Pro Project', extensions: ['epp'] }],
              properties: ['openFile'],
            });
            if (files && files.length > 0) {
              const existingWindow = BrowserWindow.getAllWindows().find((w) => w.projectPath === files[0]);
              if (!existingWindow) {
                createWindow(files[0]);
              }
            }
          },
          accelerator: 'CmdOrCtrl+O',
        },
        {
          id: 'saveProject',
          label: 'Save Project',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) saveProject(focusedWindow);
          },
          accelerator: 'CmdOrCtrl+S',
          enabled: false,
        },
        {
          label: 'Save Project As...',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) saveProjectAs(focusedWindow);
          },
          accelerator: 'Shift+CmdOrCtrl+S',
        },
        {
          label: 'Close Window',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) focusedWindow.close();
          },
          accelerator: 'CmdOrCtrl+W',
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
