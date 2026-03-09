/*
  # Add missing indexes on foreign keys

  1. Performance Improvements
    - `email_logs.credit_note_id` - Index for credit note lookups in email logs
    - `invoice_line_items.booking_id` - Index for booking lookups in line items
    - `invoices.external_customer_id` - Index for external customer invoice lookups
    - `invoices.tenant_id` - Index for tenant invoice lookups
    - `lease_spaces.space_id` - Index for space lookups in lease spaces
    - `leases.tenant_id` - Index for tenant lease lookups
    - `meeting_room_bookings.recurring_pattern_id` - Index for recurring pattern lookups
    - `meter_groups.tenant_id` - Index for tenant meter group lookups

  2. Notes
    - All indexes are on foreign key columns that were missing covering indexes
    - This improves JOIN performance and DELETE cascade operations
*/

CREATE INDEX IF NOT EXISTS idx_email_logs_credit_note_id
  ON email_logs (credit_note_id);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_booking_id
  ON invoice_line_items (booking_id);

CREATE INDEX IF NOT EXISTS idx_invoices_external_customer_id
  ON invoices (external_customer_id);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id
  ON invoices (tenant_id);

CREATE INDEX IF NOT EXISTS idx_lease_spaces_space_id
  ON lease_spaces (space_id);

CREATE INDEX IF NOT EXISTS idx_leases_tenant_id
  ON leases (tenant_id);

CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_recurring_pattern_id
  ON meeting_room_bookings (recurring_pattern_id);

CREATE INDEX IF NOT EXISTS idx_meter_groups_tenant_id
  ON meter_groups (tenant_id);
