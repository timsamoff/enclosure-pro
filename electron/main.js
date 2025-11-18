const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

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

  mainWindow.webContents.openDevTools();

  // Remove the system menu bar
  Menu.setApplicationMenu(null);

  // Prevent window from closing, let renderer handle it
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.webContents.send('window-close-requested');
  });

  // Always load from built files (standalone Electron app)
  mainWindow.loadFile(path.join(__dirname, '../dist/public/index.html'));
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
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

ipcMain.handle('print-pdf', async (event, { pdfData, printOptions }) => {
  const pdfBuffer = Buffer.from(pdfData);
  const pdfPath = path.join(os.tmpdir(), `print-${Date.now()}.pdf`);
  
  await fs.promises.writeFile(pdfPath, pdfBuffer);
  
  const printWindow = new BrowserWindow({ show: false });
  await printWindow.loadURL(`file://${pdfPath}`);
  
  return new Promise((resolve) => {
    printWindow.webContents.once('did-finish-load', () => {
      printWindow.webContents.print(printOptions, (success) => {
        printWindow.destroy();
        resolve(success);
      });
    });
  });
});