/// <reference types="vite/client" />

interface Window {
  electron?: {
    sendEmailWithPDF: (pdfBuffer: ArrayBuffer, to: string, subject: string, body: string) => Promise<{ success: boolean; error?: string; warning?: string }>;
    selectFolder: () => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
    createTenantFolder: (rootPath: string, tenantName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    savePDF: (pdfBuffer: ArrayBuffer, folderPath: string, fileName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    getAppVersion: () => Promise<string>;
    checkForUpdates: () => Promise<{ success: boolean; message?: string; error?: string; updateInfo?: any; details?: any }>;
  };
  electronAPI?: {
    sendEmailWithPDF: (pdfBuffer: ArrayBuffer, to: string, subject: string, body: string) => Promise<{ success: boolean; error?: string; warning?: string }>;
    selectFolder: () => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
    createTenantFolder: (rootPath: string, tenantName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    savePDF: (pdfBuffer: ArrayBuffer, folderPath: string, fileName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    getAppVersion: () => Promise<string>;
    checkForUpdates: () => Promise<{ success: boolean; message?: string; error?: string; updateInfo?: any; details?: any }>;
  };
}
