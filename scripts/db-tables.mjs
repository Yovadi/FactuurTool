/**
 * Public tables used by HAL5 Facturatie Manager, in parent-first
 * restore order so foreign keys stay valid.
 */
export const TABLES = [
  'company_settings',
  'tenants',
  'external_customers',
  'office_spaces',
  'space_type_rates',
  'leases',
  'lease_spaces',
  'wifi_networks',
  'patch_ports',
  'meter_groups',
  'rcbo_circuit_breakers',
  'invoices',
  'invoice_line_items',
  'credit_notes',
  'credit_note_line_items',
  'credit_note_applications',
  'meeting_room_bookings',
  'recurring_booking_patterns',
  'flex_schedules',
  'flex_day_bookings',
  'purchase_invoices',
  'purchase_invoice_line_items',
  'scheduled_jobs',
  'admin_notifications',
  'email_logs',
  'eboekhouden_grootboek_mapping',
  'eboekhouden_sync_log',
];

export const STORAGE_BUCKETS = ['purchase-invoices'];

export const CURRENT_PROJECT_REF = 'qlvndvpxhqmjljjpehkn';
export const CURRENT_PROJECT_URL = `https://${CURRENT_PROJECT_REF}.supabase.co`;
