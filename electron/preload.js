const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
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
  },
  getAppVersion: () => {
    return ipcRenderer.invoke('get-app-version');
  },
  checkForUpdates: () => {
    return ipcRenderer.invoke('check-for-updates');
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_, data) => callback(data));
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', (_, data) => callback(data));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_, data) => callback(data));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (_, data) => callback(data));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_, data) => callback(data));
  },
  downloadUpdate: () => {
    return ipcRenderer.invoke('download-update');
  },
  installUpdate: () => {
    return ipcRenderer.invoke('install-update');
  },
  getLogoBase64: () => {
    return ipcRenderer.invoke('get-logo-base64');
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
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
  },
  getAppVersion: () => {
    return ipcRenderer.invoke('get-app-version');
  },
  checkForUpdates: () => {
    return ipcRenderer.invoke('check-for-updates');
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_, data) => callback(data));
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', (_, data) => callback(data));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_, data) => callback(data));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (_, data) => callback(data));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_, data) => callback(data));
  },
  downloadUpdate: () => {
    return ipcRenderer.invoke('download-update');
  },
  installUpdate: () => {
    return ipcRenderer.invoke('install-update');
  },
  getLogoBase64: () => {
    return ipcRenderer.invoke('get-logo-base64');
  }
});
