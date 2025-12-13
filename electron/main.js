const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

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

autoUpdater.on('update-available', (info) => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Beschikbaar',
    message: `Nieuwe versie ${info.version} is beschikbaar!`,
    detail: 'Wilt u de update nu downloaden? De update wordt geïnstalleerd wanneer u de applicatie afsluit.',
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

autoUpdater.on('update-not-available', () => {
  console.log('No updates available');
});

autoUpdater.on('error', (err) => {
  console.error('Update error:', err);
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
    autoUpdater.checkForUpdates();
  }
}

app.whenReady().then(() => {
  createWindow();

  setTimeout(() => {
    checkForUpdates();
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
