export async function getLocalRootFolderPath(): Promise<string | null> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.getLocalSetting) return null;

  try {
    const result = await electronAPI.getLocalSetting('root_folder_path');
    if (result?.success && result.value) return result.value;
  } catch {}

  return null;
}

export async function setLocalRootFolderPath(path: string): Promise<void> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.setLocalSetting) return;

  try {
    await electronAPI.setLocalSetting('root_folder_path', path);
  } catch {}
}

export async function getEffectiveRootFolderPath(dbPath?: string | null): Promise<string | null> {
  const localPath = await getLocalRootFolderPath();
  return localPath || dbPath || null;
}
