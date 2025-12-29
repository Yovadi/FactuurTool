const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;
let isManualUpdateCheck = false;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;
autoUpdater.allowDowngrade = false;

// Stel de update feed URL expliciet in
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'Yovadi',
  repo: 'FactuurTool',
  private: false,
  releaseType: 'release'
});

// Logging voor debugging
try {
  autoUpdater.logger = require('electron-log');
  autoUpdater.logger.transports.file.level = 'info';
  console.log('electron-log enabled for auto-updater');
} catch (err) {
  console.log('electron-log not available, using console logging');
  autoUpdater.logger = console;
}

console.log('App version:', app.getVersion());
console.log('App path:', app.getAppPath());

function createWindow() {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: false,
      sandbox: false
    },
    icon: path.join(__dirname, '../public/Logo.png'),
    title: 'HAL5 Overloon - Facturatie Manager',
    show: false
  });

  mainWindow.maximize();
  mainWindow.show();

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`Console [${level}]:`, message);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('send-email-with-pdf', async (event, pdfBuffer, to, subject, body, fileName, logoPath) => {
  try {
    const fs = require('fs');
    const os = require('os');
    const tempDir = os.tmpdir();
    const sanitizedFileName = (fileName || `invoice-${Date.now()}`).replace(/[<>:"/\\|?*]/g, '_');
    const tempFilePath = path.join(tempDir, sanitizedFileName + '.pdf');

    fs.writeFileSync(tempFilePath, Buffer.from(pdfBuffer));

    if (process.platform === 'win32') {
      try {
        const { execSync } = require('child_process');

        let psScript = `
          $outlook = New-Object -ComObject Outlook.Application
          $mail = $outlook.CreateItem(0)
          $mail.To = "${to.replace(/"/g, '""')}"
          $mail.Subject = "${subject.replace(/"/g, '""')}"
          $mail.Body = @"
${body.replace(/"/g, '""')}
"@
          $mail.Attachments.Add("${tempFilePath.replace(/\\/g, '\\\\')}")
          $mail.Display()
        `;

        const psScriptPath = path.join(tempDir, `outlook-script-${Date.now()}.ps1`);
        fs.writeFileSync(psScriptPath, psScript, 'utf8');

        execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, {
          windowsHide: true
        });

        setTimeout(() => {
          try {
            fs.unlinkSync(tempFilePath);
            fs.unlinkSync(psScriptPath);
          } catch (err) {
            console.error('Error deleting temp files:', err);
          }
        }, 30000);

        return { success: true };
      } catch (comError) {
        console.error('COM Automation failed, falling back to mailto:', comError);

        const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        await shell.openExternal(mailtoUrl);

        setTimeout(() => {
          try {
            fs.unlinkSync(tempFilePath);
          } catch (err) {
            console.error('Error deleting temp file:', err);
          }
        }, 10000);

        return { success: true, warning: 'PDF niet automatisch bijgevoegd. Voeg handmatig toe.' };
      }
    } else {
      const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      await shell.openExternal(mailtoUrl);

      setTimeout(() => {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (err) {
          console.error('Error deleting temp file:', err);
        }
      }, 10000);

      return { success: true, warning: 'PDF niet automatisch bijgevoegd. Voeg handmatig toe.' };
    }
  } catch (error) {
    console.error('Error opening email client:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { success: true, path: result.filePaths[0] };
  } catch (error) {
    console.error('Error selecting folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-tenant-folder', async (event, rootPath, tenantName) => {
  try {
    const fs = require('fs');

    if (!rootPath || !tenantName) {
      return { success: false, error: 'Root path en tenant naam zijn verplicht' };
    }

    const sanitizedName = tenantName.replace(/[<>:"/\\|?*]/g, '_');
    const tenantFolderPath = path.join(rootPath, sanitizedName);

    if (!fs.existsSync(tenantFolderPath)) {
      fs.mkdirSync(tenantFolderPath, { recursive: true });
    }

    return { success: true, path: tenantFolderPath };
  } catch (error) {
    console.error('Error creating tenant folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-pdf', async (event, pdfBuffer, folderPath, fileName) => {
  try {
    const fs = require('fs');

    if (!folderPath || !fileName) {
      return { success: false, error: 'Folder path en bestandsnaam zijn verplicht' };
    }

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
    const filePath = path.join(folderPath, sanitizedFileName);

    fs.writeFileSync(filePath, Buffer.from(pdfBuffer));

    return { success: true, path: filePath };
  } catch (error) {
    console.error('Error saving PDF:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', async () => {
  try {
    if (process.env.NODE_ENV === 'development') {
      return {
        success: false,
        message: 'Update check is uitgeschakeld in development modus'
      };
    }

    isManualUpdateCheck = true;

    console.log('=== MANUAL UPDATE CHECK ===');
    console.log('Current version:', app.getVersion());
    console.log('Feed URL:', JSON.stringify(autoUpdater.getFeedURL(), null, 2));
    console.log('Is app packaged?', app.isPackaged);
    console.log('App path:', app.getAppPath());
    console.log('Checking URL: https://github.com/Yovadi/FactuurTool/releases/latest');

    const result = await autoUpdater.checkForUpdates();
    console.log('Update check result:', JSON.stringify(result, null, 2));

    if (result && result.updateInfo) {
      console.log('Available version:', result.updateInfo.version);
      console.log('Current < Available?', app.getVersion() < result.updateInfo.version);
    }

    // Reset flag after a short delay
    setTimeout(() => {
      isManualUpdateCheck = false;
    }, 3000);

    return {
      success: true,
      message: 'Update check gestart',
      updateInfo: result?.updateInfo,
      currentVersion: app.getVersion(),
      isPackaged: app.isPackaged
    };
  } catch (error) {
    isManualUpdateCheck = false;

    console.error('Error checking for updates:', error);
    console.error('Error stack:', error.stack);

    if (error.message && error.message.includes('404')) {
      return {
        success: false,
        message: 'Er zijn momenteel geen updates beschikbaar. U gebruikt al de nieuwste versie.',
        currentVersion: app.getVersion()
      };
    }

    return {
      success: false,
      message: `Kon niet checken voor updates: ${error.message}`,
      currentVersion: app.getVersion(),
      error: error.message
    };
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', JSON.stringify(info, null, 2));

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Beschikbaar',
    message: `Nieuwe versie ${info.version} is beschikbaar!`,
    detail: `Huidige versie: ${app.getVersion()}\nNieuwe versie: ${info.version}\n\nWilt u de update nu downloaden? De update wordt geïnstalleerd wanneer u de applicatie afsluit.`,
    buttons: ['Download Update', 'Later'],
    defaultId: 0,
    cancelId: 1
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();

      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Downloaden',
        message: 'Update wordt gedownload op de achtergrond...',
        buttons: ['OK']
      });
    }
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('=== NO UPDATE AVAILABLE ===');
  console.log('Current version:', app.getVersion());
  console.log('Latest available version:', info?.version);
  console.log('Update info:', JSON.stringify(info, null, 2));

  // Only show message when user manually checks
  if (isManualUpdateCheck && mainWindow && mainWindow.webContents) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Geen Updates',
      message: 'U gebruikt al de nieuwste versie',
      detail: `Huidige versie: ${app.getVersion()}\n\nEr zijn geen nieuwe updates beschikbaar.`,
      buttons: ['OK']
    });
  }
});

autoUpdater.on('error', (err) => {
  console.error('=== UPDATE ERROR ===');
  console.error('Error message:', err.message);
  console.error('Error stack:', err.stack);
  console.error('Error code:', err.code);
  console.error('Error name:', err.name);
  console.error('Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));

  if (isManualUpdateCheck && mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Update Error',
      message: 'Er ging iets fout bij het checken voor updates',
      detail: `Error: ${err.message}\n\nControleer de console voor meer details.`,
      buttons: ['OK']
    });
  }
});

autoUpdater.on('checking-for-update', () => {
  console.log('=== CHECKING FOR UPDATE ===');
  console.log('Current version:', app.getVersion());
  console.log('Repository:', 'https://github.com/Yovadi/FactuurTool');
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`Download progress: ${Math.round(progressObj.percent)}%`);
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Klaar',
    message: 'Update is gedownload en wordt geïnstalleerd bij het afsluiten van de applicatie.',
    detail: 'Wilt u nu herstarten om de update te installeren?',
    buttons: ['Nu Herstarten', 'Later'],
    defaultId: 0,
    cancelId: 1
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });
});

function checkForUpdates() {
  if (process.env.NODE_ENV !== 'development') {
    console.log('=== Update Check Started ===');
    console.log('Current version:', app.getVersion());
    console.log('Update feed URL:', autoUpdater.getFeedURL());

    autoUpdater.checkForUpdates()
      .then(result => {
        console.log('Update check completed:', JSON.stringify(result, null, 2));
      })
      .catch(err => {
        if (err.message && err.message.includes('404')) {
          console.log('No updates available on GitHub (404). This is normal if no releases are published yet.');
        } else {
          console.error('Error checking for updates:', err.message);
        }
      });
  } else {
    console.log('Skipping update check in development mode');
  }
}

// Periodiek checken voor updates (elk uur)
function startPeriodicUpdateCheck() {
  if (process.env.NODE_ENV !== 'development') {
    setInterval(() => {
      console.log('Periodic update check...');
      autoUpdater.checkForUpdates().catch(err => {
        if (err.message && err.message.includes('404')) {
          console.log('No updates available (404).');
        } else {
          console.error('Error in periodic update check:', err.message);
        }
      });
    }, 60 * 60 * 1000); // Elk uur
  }
}

app.whenReady().then(() => {
  createWindow();

  setTimeout(() => {
    checkForUpdates();
    startPeriodicUpdateCheck();
  }, 3000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
