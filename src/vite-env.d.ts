/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    sendEmailWithPDF: (pdfBuffer: ArrayBuffer, to: string, subject: string, body: string) => Promise<{ success: boolean; error?: string; warning?: string }>;
    selectFolder: () => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
    createTenantFolder: (rootPath: string, tenantName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    savePDF: (pdfBuffer: ArrayBuffer, folderPath: string, fileName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  };
}
