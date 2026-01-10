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
    console.log('[LogoLoader] Returning cached logo, length:', cachedLogo.length);
    return cachedLogo;
  }

  if (window.electron?.getLogoBase64) {
    try {
      console.log('[LogoLoader] Attempting to load logo from Electron...');
      const logo = await window.electron.getLogoBase64();
      if (logo) {
        console.log('[LogoLoader] Loaded logo from Electron, length:', logo.length);
        cachedLogo = logo;
        return logo;
      }
    } catch (error) {
      console.warn('Failed to load logo from Electron, using embedded base64:', error);
    }
  }

  console.log('[LogoLoader] Using embedded base64, length:', LOGO_BASE64.length, 'starts with:', LOGO_BASE64.substring(0, 50));
  cachedLogo = LOGO_BASE64;
  return LOGO_BASE64;
}
