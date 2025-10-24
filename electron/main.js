const { app, BrowserWindow, ipcMain, shell } = require('electron');
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

ipcMain.handle('send-email-with-pdf', async (event, pdfBuffer, to, subject, body) => {
  try {
    const fs = require('fs');
    const os = require('os');
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `invoice-${Date.now()}.pdf`);

    fs.writeFileSync(tempFilePath, Buffer.from(pdfBuffer));

    if (process.platform === 'win32') {
      try {
        const { execSync } = require('child_process');

        const psScript = `
          $outlook = New-Object -ComObject Outlook.Application
          $mail = $outlook.CreateItem(0)
          $mail.To = "${to.replace(/"/g, '""')}"
          $mail.Subject = "${subject.replace(/"/g, '""')}"
          $mail.Body = "${body.replace(/"/g, '""').replace(/\n/g, '`n')}"
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
