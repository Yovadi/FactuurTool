import { app, ipcMain, shell, BrowserWindow } from "electron";
import { dirname, join } from "path";
import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDev = process.env.NODE_ENV === "development";
let mainWindow = null;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
ipcMain.handle("send-email-with-pdf", async (event, { pdfBlob, recipient, subject, body }) => {
  try {
    const buffer = Buffer.from(new Uint8Array(pdfBlob));
    const tempPath = join(tmpdir(), `invoice-${Date.now()}.pdf`);
    writeFileSync(tempPath, buffer);
    const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await shell.openExternal(mailtoUrl);
    setTimeout(() => {
      shell.openPath(tempPath);
    }, 500);
    return { success: true, message: "Outlook geopend met e-mail. PDF wordt geopend voor bijvoegen." };
  } catch (error) {
    console.error("Error opening email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});
