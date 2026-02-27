/// <reference types="vite/client" />

interface ElectronAPI {
  sendEmailWithPDF: (pdfBuffer: ArrayBuffer, to: string, subject: string, body: string) => Promise<{ success: boolean; error?: string; warning?: string }>;
  selectFolder: () => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
  createTenantFolder: (rootPath: string, tenantName: string, category?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  savePDF: (pdfBuffer: ArrayBuffer, folderPath: string, fileName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  renameFolder: (oldPath: string, newPath: string) => Promise<{ success: boolean; path?: string; error?: string; notFound?: boolean }>;
  moveAllFolders: (oldRootPath: string, newRootPath: string) => Promise<{ success: boolean; moved?: string[]; failed?: Array<{ name: string; error: string }>; error?: string; notFound?: boolean }>;
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<{ success: boolean; message?: string; error?: string; updateInfo?: any; details?: any }>;
}

interface Window {
  electron?: ElectronAPI;
  electronAPI?: ElectronAPI;
}
