const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/Logo.png'),
    title: 'HAL5 Overloon - Facturatie Manager',
  });

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

        const htmlBody = `
          <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6;">
            <p>${body.replace(/\n/g, '<br>')}</p>
            ${logoPath ? `<br><img src="cid:logo" alt="Hal 5 Overloon Logo" style="max-width: 300px;"><br>` : ''}
          </body>
          </html>
        `;

        let psScript = `
          $outlook = New-Object -ComObject Outlook.Application
          $mail = $outlook.CreateItem(0)
          $mail.To = "${to.replace(/"/g, '""')}"
          $mail.Subject = "${subject.replace(/"/g, '""')}"
          $mail.HTMLBody = @"
${htmlBody.replace(/"/g, '""')}
"@
          $mail.Attachments.Add("${tempFilePath.replace(/\\/g, '\\\\')}")
        `;

        if (logoPath) {
          const logoFullPath = path.resolve(logoPath);
          psScript += `
          $attachment = $mail.Attachments.Add("${logoFullPath.replace(/\\/g, '\\\\')}")
          $attachment.PropertyAccessor.SetProperty("http://schemas.microsoft.com/mapi/proptag/0x3712001F", "logo")
          `;
        }

        psScript += `
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

app.whenReady().then(createWindow);

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
