import { supabase } from '../lib/supabase';

export async function logAudit(
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: string | null
) {
  try {
    await supabase.from('audit_log').insert({
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      details: details || null,
    });
  } catch (error) {
    console.error('Audit log failed:', error);
  }
}
