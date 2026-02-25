const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getLocalSetting: (key) => {
    return ipcRenderer.invoke('get-local-setting', key);
  },
  setLocalSetting: (key, value) => {
    return ipcRenderer.invoke('set-local-setting', key, value);
  },
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
  renameFolder: (oldPath, newPath) => {
    return ipcRenderer.invoke('rename-folder', oldPath, newPath);
  },
  moveAllFolders: (oldRootPath, newRootPath) => {
    return ipcRenderer.invoke('move-all-folders', oldRootPath, newRootPath);
  },
  listInvoicesOnDisk: (rootPath) => {
    return ipcRenderer.invoke('list-invoices-on-disk', rootPath);
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
  },
  openPreviewWindow: (previewData) => {
    return ipcRenderer.invoke('open-preview-window', previewData);
  },
  closePreviewWindow: () => {
    return ipcRenderer.invoke('close-preview-window');
  },
  onPreviewData: (callback) => {
    ipcRenderer.on('preview-data', (_, data) => callback(data));
  },
  sendPreviewAction: (action, data) => {
    return ipcRenderer.invoke('preview-action', action, data);
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  getLocalSetting: (key) => {
    return ipcRenderer.invoke('get-local-setting', key);
  },
  setLocalSetting: (key, value) => {
    return ipcRenderer.invoke('set-local-setting', key, value);
  },
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
  renameFolder: (oldPath, newPath) => {
    return ipcRenderer.invoke('rename-folder', oldPath, newPath);
  },
  moveAllFolders: (oldRootPath, newRootPath) => {
    return ipcRenderer.invoke('move-all-folders', oldRootPath, newRootPath);
  },
  listInvoicesOnDisk: (rootPath) => {
    return ipcRenderer.invoke('list-invoices-on-disk', rootPath);
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
  },
  openPreviewWindow: (previewData) => {
    return ipcRenderer.invoke('open-preview-window', previewData);
  },
  closePreviewWindow: () => {
    return ipcRenderer.invoke('close-preview-window');
  },
  onPreviewData: (callback) => {
    ipcRenderer.on('preview-data', (_, data) => callback(data));
  },
  sendPreviewAction: (action, data) => {
    return ipcRenderer.invoke('preview-action', action, data);
  },
  onPreviewAction: (callback) => {
    ipcRenderer.on('preview-action', (_, action, data) => callback(action, data));
  }
});
