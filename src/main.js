const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow = null;
let recentFiles = [];
const recentFilesPath = path.join(app.getPath('userData'), 'recentFiles.json');
const untitledBaseName = 'Untitled';
const projectExtension = '.epp';

// Initialize application
function initialize() {
  loadRecentFiles();
  createWindow();
  initializeIpcHandlers();
}

// Recent files management
function loadRecentFiles() {
  try {
    if (fs.existsSync(recentFilesPath)) {
      recentFiles = JSON.parse(fs.readFileSync(recentFilesPath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading recent files:', error);
  }
}

function saveRecentFiles() {
  try {
    fs.writeFileSync(recentFilesPath, JSON.stringify(recentFiles), 'utf8');
  } catch (error) {
    console.error('Error saving recent files:', error);
  }
}

function addToRecentFiles(filePath) {
  recentFiles = recentFiles.filter(file => file !== filePath);
  recentFiles.unshift(filePath);
  if (recentFiles.length > 5) recentFiles.pop();
  saveRecentFiles();
}

// Window management
function createWindow(projectPath = null) {
  if (mainWindow) {
    focusExistingWindow();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  loadProject(projectPath);
  setupWindowListeners();
}

function setupWindowListeners() {
  mainWindow.on('closed', () => mainWindow = null);
  mainWindow.on('close', handleWindowClose);
}

function handleWindowClose(e) {
  if (mainWindow && !mainWindow.isSaved) {
    e.preventDefault();
    showUnsavedChangesDialog();
  }
}

function showUnsavedChangesDialog() {
  dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Save', "Don't Save", 'Cancel'],
    title: 'Unsaved Changes',
    message: 'Do you want to save your changes?'
  }).then(({ response }) => {
    if (response === 0) saveProject(mainWindow);
    if (response !== 2) mainWindow.destroy();
  }).catch(console.error);
}

// Project management
function loadProject(projectPath) {
  if (!projectPath) {
    createNewProject();
    return;
  }

  try {
    const data = fs.readFileSync(projectPath, 'utf8');
    mainWindow.projectPath = projectPath;
    mainWindow.isSaved = true;
    mainWindow.setTitle(path.basename(projectPath));
    mainWindow.webContents.send('load-project', JSON.parse(data));
    addToRecentFiles(projectPath);
  } catch (error) {
    console.error('Error loading project:', error);
    dialog.showErrorBox('Load Error', `Failed to load project: ${error.message}`);
    createNewProject();
  }
}

function createNewProject() {
  mainWindow.projectPath = null;
  mainWindow.isSaved = false;
  mainWindow.setTitle(`${untitledBaseName}*`);
}

function saveProject(win) {
  if (!win.projectPath) {
    saveProjectAs(win);
    return;
  }

  try {
    const data = JSON.stringify({ /* Your project data */ });
    fs.writeFileSync(win.projectPath, data, 'utf8');
    win.isSaved = true;
    win.setTitle(path.basename(win.projectPath));
  } catch (error) {
    console.error('Save error:', error);
    dialog.showErrorBox('Save Error', 'Failed to save project');
  }
}

function saveProjectAs(win) {
  dialog.showSaveDialog(win, {
    filters: [{ name: 'Enclosure Pro Projects', extensions: ['epp'] }],
    defaultPath: win.projectPath || `${untitledBaseName}${projectExtension}`
  }).then(({ filePath }) => {
    if (filePath) {
      win.projectPath = filePath;
      saveProject(win);
      addToRecentFiles(filePath);
    }
  }).catch(console.error);
}

// IPC Handlers
function initializeIpcHandlers() {
  ipcMain.handle('get-recent-files', () => recentFiles);
  
  ipcMain.on('toggle-grid', (_, state) => {
    mainWindow?.webContents.send('toggle-grid', state);
  });

  ipcMain.on('update-save-state', (_, isSaved) => {
    if (mainWindow) {
      mainWindow.isSaved = isSaved;
      updateSaveMenu();
    }
  });
}

function updateSaveMenu() {
  const menu = Menu.getApplicationMenu();
  const saveItem = menu.getMenuItemById('saveProject');
  if (saveItem) saveItem.enabled = !mainWindow?.isSaved;
}

// App lifecycle
app.whenReady().then(() => {
  const { createMenu } = require('./main_menu');
  Menu.setApplicationMenu(createMenu({
    createWindow,
    saveProject,
    saveProjectAs,
    recentFiles,
    saveRecentFiles
  }));
  initialize();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});