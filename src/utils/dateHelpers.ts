import { supabase } from '../lib/supabase';

export async function getCurrentDate(): Promise<Date> {
  const { data: settings } = await supabase
    .from('company_settings')
    .select('test_mode, test_date')
    .maybeSingle();

  if (settings?.test_mode && settings?.test_date) {
    return new Date(settings.test_date);
  }

  return new Date();
}

export async function getCurrentDateString(): Promise<string> {
  const date = await getCurrentDate();
  return date.toISOString().split('T')[0];
}
