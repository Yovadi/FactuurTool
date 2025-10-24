import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  sendEmailWithPDF: (pdfBlob: ArrayBuffer, recipient: string, subject: string, body: string) =>
    ipcRenderer.invoke('send-email-with-pdf', { pdfBlob, recipient, subject, body }),
});
