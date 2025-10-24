export interface ElectronAPI {
  sendEmailWithPDF: (
    pdfBlob: ArrayBuffer,
    recipient: string,
    subject: string,
    body: string
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
