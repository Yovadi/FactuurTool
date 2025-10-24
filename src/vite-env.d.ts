/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    sendEmailWithPDF: (pdfBuffer: ArrayBuffer, to: string, subject: string, body: string) => Promise<{ success: boolean; error?: string }>;
  };
}
