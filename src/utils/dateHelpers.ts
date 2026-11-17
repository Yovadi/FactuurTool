import { supabase } from '../lib/supabase';
import { businessDate, businessInstant } from './businessClock';

async function readTestDate(): Promise<{ testMode: boolean; testDate: string | null }> {
  const { data: settings } = await supabase
    .from('company_settings')
    .select('test_mode, test_date')
    .maybeSingle();
  return {
    testMode: settings?.test_mode === true,
    testDate: settings?.test_date || null,
  };
}

export async function getCurrentDateString(): Promise<string> {
  const { testMode, testDate } = await readTestDate();
  return businessDate(testMode, testDate);
}

export async function getCurrentDate(): Promise<Date> {
  return businessInstant(await getCurrentDateString());
}
