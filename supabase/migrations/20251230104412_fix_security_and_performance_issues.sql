/*
  # Fix Security and Performance Issues

  1. Add Missing Indexes on Foreign Keys
    - credit_note_line_items.credit_note_id
    - credit_notes.external_customer_id
    - credit_notes.original_invoice_id
    - credit_notes.tenant_id
    - flex_schedules.space_id
    - invoices.external_customer_id
    - invoices.tenant_id
    - meeting_room_bookings.invoice_id
    - recurring_booking_patterns.tenant_id

  2. Remove Unused Indexes
    - idx_leases_tenant_id
    - idx_invoices_lease_id
    - idx_invoices_status
    - idx_lease_spaces_lease_id
    - idx_lease_spaces_space_id
    - idx_bookings_tenant_id
    - idx_bookings_space_date
    - idx_recurring_patterns_active
    - idx_bookings_recurring_pattern
    - idx_leases_status
    - idx_invoice_line_items_booking_id

  3. Fix Function Search Path
    - Set immutable search_path for all functions to prevent search path injection attacks
*/

-- Add missing indexes on foreign keys for better query performance
CREATE INDEX IF NOT EXISTS idx_credit_note_line_items_credit_note_id 
  ON public.credit_note_line_items(credit_note_id);

CREATE INDEX IF NOT EXISTS idx_credit_notes_external_customer_id 
  ON public.credit_notes(external_customer_id);

CREATE INDEX IF NOT EXISTS idx_credit_notes_original_invoice_id 
  ON public.credit_notes(original_invoice_id);

CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant_id 
  ON public.credit_notes(tenant_id);

CREATE INDEX IF NOT EXISTS idx_flex_schedules_space_id 
  ON public.flex_schedules(space_id);

CREATE INDEX IF NOT EXISTS idx_invoices_external_customer_id 
  ON public.invoices(external_customer_id);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id 
  ON public.invoices(tenant_id);

CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_invoice_id 
  ON public.meeting_room_bookings(invoice_id);

CREATE INDEX IF NOT EXISTS idx_recurring_booking_patterns_tenant_id 
  ON public.recurring_booking_patterns(tenant_id);

-- Remove unused indexes
DROP INDEX IF EXISTS idx_leases_tenant_id;
DROP INDEX IF EXISTS idx_invoices_lease_id;
DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_lease_spaces_lease_id;
DROP INDEX IF EXISTS idx_lease_spaces_space_id;
DROP INDEX IF EXISTS idx_bookings_tenant_id;
DROP INDEX IF EXISTS idx_bookings_space_date;
DROP INDEX IF EXISTS idx_recurring_patterns_active;
DROP INDEX IF EXISTS idx_bookings_recurring_pattern;
DROP INDEX IF EXISTS idx_leases_status;
DROP INDEX IF EXISTS idx_invoice_line_items_booking_id;

-- Fix function search paths to prevent search path injection attacks
ALTER FUNCTION public.update_meeting_room_bookings_updated_at() SET search_path = public;
ALTER FUNCTION public.update_space_type_rates_updated_at() SET search_path = public;
ALTER FUNCTION public.get_flex_credits_used(uuid, integer, integer) SET search_path = public;
ALTER FUNCTION public.generate_credit_note_number() SET search_path = public;
ALTER FUNCTION public.get_available_credit(uuid) SET search_path = public;
ALTER FUNCTION public.update_invoice_applied_credit() SET search_path = public;
ALTER FUNCTION public.get_flex_credits_used_weekly(uuid, date) SET search_path = public;
ALTER FUNCTION public.generate_invoice_number() SET search_path = public;
ALTER FUNCTION public.sync_rates_to_office_spaces() SET search_path = public;
ALTER FUNCTION public.check_flex_credit_limit() SET search_path = public;
ALTER FUNCTION public.calculate_lease_total_rent(uuid) SET search_path = public;
ALTER FUNCTION public.calculate_vat(numeric, numeric, boolean) SET search_path = public;
