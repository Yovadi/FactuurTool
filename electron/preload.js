const { ipcRenderer } = require('electron');

window.electronAPI = {
  sendEmailWithPDF: (pdfBuffer, to, subject, body) => {
    return ipcRenderer.invoke('send-email-with-pdf', pdfBuffer, to, subject, body);
  }
};
