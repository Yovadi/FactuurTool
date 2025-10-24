"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  sendEmailWithPDF: (pdfBlob, recipient, subject, body) => electron.ipcRenderer.invoke("send-email-with-pdf", { pdfBlob, recipient, subject, body })
});
