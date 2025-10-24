import { app as n, ipcMain as f, shell as i, BrowserWindow as w } from "electron";
import { dirname as u, join as t } from "path";
import { writeFileSync as h } from "fs";
import { tmpdir as v } from "os";
import { fileURLToPath as g } from "url";
const U = g(import.meta.url), a = u(U), b = process.env.NODE_ENV === "development";
let e = null;
function l() {
  e = new w({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: t(a, "preload.js"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), b ? (e.loadURL("http://localhost:5173"), e.webContents.openDevTools()) : e.loadFile(t(a, "../dist/index.html")), e.on("closed", () => {
    e = null;
  });
}
n.whenReady().then(l);
n.on("window-all-closed", () => {
  process.platform !== "darwin" && n.quit();
});
n.on("activate", () => {
  e === null && l();
});
f.handle("send-email-with-pdf", async (y, { pdfBlob: s, recipient: m, subject: c, body: d }) => {
  try {
    const o = Buffer.from(new Uint8Array(s)), r = t(v(), `invoice-${Date.now()}.pdf`);
    h(r, o);
    const p = `mailto:${m}?subject=${encodeURIComponent(c)}&body=${encodeURIComponent(d)}`;
    return await i.openExternal(p), setTimeout(() => {
      i.openPath(r);
    }, 500), { success: !0, message: "Outlook geopend met e-mail. PDF wordt geopend voor bijvoegen." };
  } catch (o) {
    return console.error("Error opening email:", o), { success: !1, error: o instanceof Error ? o.message : "Unknown error" };
  }
});
