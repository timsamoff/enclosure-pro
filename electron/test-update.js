// electron/test-update.js
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

function setupTestUpdater(mainWindow) {
  // Simulate update available
  const simulateUpdate = () => {
    console.log('🔧 Simulating update available...');
    
    // Simulate update-available event
    mainWindow.webContents.send('update-available', {
      version: '1.0.1',
      releaseDate: new Date().toISOString()
    });
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'TEST - Update Available',
      message: 'Simulated: Version 1.0.1 is available!',
      buttons: ['Download', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        // Simulate download progress
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          mainWindow.webContents.send('download-progress', {
            percent: progress,
            bytesPerSecond: 1000000,
            total: 50000000,
            transferred: progress * 500000
          });
          
          if (progress >= 100) {
            clearInterval(interval);
            // Simulate update downloaded
            setTimeout(() => {
              mainWindow.webContents.send('update-downloaded', {
                version: '1.0.1'
              });
              
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'TEST - Update Ready',
                message: 'Simulated: Update downloaded. Would you like to restart?',
                buttons: ['Restart', 'Later']
              });
            }, 1000);
          }
        }, 200);
      }
    });
  };

  // Add test menu item
  const { Menu } = require('electron');
  const template = Menu.getApplicationMenu().items.find(item => item.label === 'Help');
  if (template) {
    template.submenu.insert(0, {
      label: 'TEST: Simulate Update',
      click: () => simulateUpdate()
    });
    template.submenu.insert(1, { type: 'separator' });
    Menu.setApplicationMenu(Menu.getApplicationMenu());
  }

  console.log('🔧 Test updater ready - Check Help menu for "TEST: Simulate Update"');
}

module.exports = { setupTestUpdater };