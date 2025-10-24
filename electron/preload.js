const { ipcRenderer } = require('electron');

window.electronAPI = {
  sendEmailWithPDF: (pdfBuffer, to, subject, body, fileName, logoPath) => {
    return ipcRenderer.invoke('send-email-with-pdf', pdfBuffer, to, subject, body, fileName, logoPath);
  },
  selectFolder: () => {
    return ipcRenderer.invoke('select-folder');
  },
  createTenantFolder: (rootPath, tenantName) => {
    return ipcRenderer.invoke('create-tenant-folder', rootPath, tenantName);
  },
  savePDF: (pdfBuffer, folderPath, fileName) => {
    return ipcRenderer.invoke('save-pdf', pdfBuffer, folderPath, fileName);
  }
};
