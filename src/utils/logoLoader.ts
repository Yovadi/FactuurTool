import { LOGO_BASE64 } from './logoBase64';

declare global {
  interface Window {
    electron?: {
      getLogoBase64: () => Promise<string | null>;
    };
  }
}

let cachedLogo: string | null = null;

export async function getLogoBase64(): Promise<string> {
  if (cachedLogo) {
    return cachedLogo;
  }

  if (window.electron?.getLogoBase64) {
    try {
      const logo = await window.electron.getLogoBase64();
      if (logo) {
        cachedLogo = logo;
        return logo;
      }
    } catch (error) {
      console.warn('Failed to load logo from Electron, using embedded base64:', error);
    }
  }

  cachedLogo = LOGO_BASE64;
  return LOGO_BASE64;
}
