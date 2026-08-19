const SECRET_KEYS = [
  'smtp_password',
  'smtp_user',
  'graph_client_secret',
  'resend_api_key',
  'eboekhouden_api_token',
  'openai_api_key',
  'staff_pin_code',
  'delete_code',
  'wifi_password',
];

export function redactSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...settings };
  for (const key of SECRET_KEYS) {
    if (key in copy && copy[key]) {
      copy[key] = '[redacted]';
    }
  }
  return copy;
}

export async function createSettingsBackup(): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await import('../lib/supabase');
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: error?.message || 'Geen bedrijfsinstellingen gevonden' };
  }

  const { error: insertError } = await supabase.from('settings_backups').insert({
    payload: redactSettings(data as Record<string, unknown>),
  });

  if (insertError) {
    return { success: false, error: insertError.message };
  }
  return { success: true };
}

export function downloadSettingsBackupFile(settings: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(redactSettings(settings), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `hal5-settings-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
