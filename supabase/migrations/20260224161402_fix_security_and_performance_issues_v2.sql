/*
  # Fix database security and performance issues

  1. Missing Foreign Key Indexes
    - Add index on `admin_notifications.external_customer_id`
    - Add index on `admin_notifications.tenant_id`
    - Add index on `credit_notes.external_customer_id`
    - Add index on `flex_day_bookings.external_customer_id`
    - Add index on `flex_day_bookings.invoice_id`
    - Add index on `flex_schedules.external_customer_id`
    - Add index on `purchase_invoice_line_items.purchase_invoice_id`

  2. RLS Policy Performance Fix
    - Replace `auth.uid()` with `(select auth.uid())` in purchase_invoices and
      purchase_invoice_line_items policies to avoid per-row re-evaluation

  3. Duplicate Index Removal
    - Drop `idx_rcbo_unique_per_ala` which duplicates `rcbo_circuit_breakers_ala_group_rcbo_number_key`

  4. Function Search Path Security
    - Set immutable search_path on `update_invoice_applied_credit`
    - Set immutable search_path on `sync_space_type_rates_to_spaces_v2`
    - Set immutable search_path on `sync_rates_to_office_spaces`

  5. Unused Index Cleanup
    - Drop `idx_email_logs_sent_at`
    - Drop `idx_email_logs_to_email`
    - Drop `idx_email_logs_credit_note_id`
    - Drop `idx_invoice_line_items_booking_id`
    - Drop `idx_leases_tenant_id`
    - Drop `idx_meeting_room_bookings_recurring_pattern_id`
    - Drop `idx_lease_spaces_space_id`
    - Drop `idx_meter_groups_tenant_id`
    - Drop `idx_admin_notifications_is_read`

  6. Notes
    - The "RLS Policy Always True" warnings are intentional for this application.
      It uses anonymous access as an internal management tool without user auth.
      Restricting those policies would break the entire application.
*/

-- =============================================================================
-- 1. Add missing foreign key indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_admin_notifications_external_customer_id
  ON public.admin_notifications (external_customer_id);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_tenant_id
  ON public.admin_notifications (tenant_id);

CREATE INDEX IF NOT EXISTS idx_credit_notes_external_customer_id
  ON public.credit_notes (external_customer_id);

CREATE INDEX IF NOT EXISTS idx_flex_day_bookings_external_customer_id
  ON public.flex_day_bookings (external_customer_id);

CREATE INDEX IF NOT EXISTS idx_flex_day_bookings_invoice_id
  ON public.flex_day_bookings (invoice_id);

CREATE INDEX IF NOT EXISTS idx_flex_schedules_external_customer_id
  ON public.flex_schedules (external_customer_id);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_line_items_purchase_invoice_id
  ON public.purchase_invoice_line_items (purchase_invoice_id);

-- =============================================================================
-- 2. Fix RLS policies: wrap auth.uid() in (select ...) for performance
-- =============================================================================

-- purchase_invoices
DROP POLICY IF EXISTS "Allow anon select on purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "Allow anon select on purchase_invoices"
  ON public.purchase_invoices FOR SELECT TO anon
  USING ((select auth.uid()) IS NULL);

DROP POLICY IF EXISTS "Allow anon insert on purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "Allow anon insert on purchase_invoices"
  ON public.purchase_invoices FOR INSERT TO anon
  WITH CHECK ((select auth.uid()) IS NULL);

DROP POLICY IF EXISTS "Allow anon update on purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "Allow anon update on purchase_invoices"
  ON public.purchase_invoices FOR UPDATE TO anon
  USING ((select auth.uid()) IS NULL)
  WITH CHECK ((select auth.uid()) IS NULL);

DROP POLICY IF EXISTS "Allow anon delete on purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "Allow anon delete on purchase_invoices"
  ON public.purchase_invoices FOR DELETE TO anon
  USING ((select auth.uid()) IS NULL);

-- purchase_invoice_line_items
DROP POLICY IF EXISTS "Allow anon select on purchase_invoice_line_items" ON public.purchase_invoice_line_items;
CREATE POLICY "Allow anon select on purchase_invoice_line_items"
  ON public.purchase_invoice_line_items FOR SELECT TO anon
  USING ((select auth.uid()) IS NULL);

DROP POLICY IF EXISTS "Allow anon insert on purchase_invoice_line_items" ON public.purchase_invoice_line_items;
CREATE POLICY "Allow anon insert on purchase_invoice_line_items"
  ON public.purchase_invoice_line_items FOR INSERT TO anon
  WITH CHECK ((select auth.uid()) IS NULL);

DROP POLICY IF EXISTS "Allow anon update on purchase_invoice_line_items" ON public.purchase_invoice_line_items;
CREATE POLICY "Allow anon update on purchase_invoice_line_items"
  ON public.purchase_invoice_line_items FOR UPDATE TO anon
  USING ((select auth.uid()) IS NULL)
  WITH CHECK ((select auth.uid()) IS NULL);

DROP POLICY IF EXISTS "Allow anon delete on purchase_invoice_line_items" ON public.purchase_invoice_line_items;
CREATE POLICY "Allow anon delete on purchase_invoice_line_items"
  ON public.purchase_invoice_line_items FOR DELETE TO anon
  USING ((select auth.uid()) IS NULL);

-- =============================================================================
-- 3. Remove duplicate index on rcbo_circuit_breakers
-- =============================================================================

DROP INDEX IF EXISTS idx_rcbo_unique_per_ala;

-- =============================================================================
-- 4. Fix mutable search_path on functions
-- =============================================================================

ALTER FUNCTION public.update_invoice_applied_credit()
  SET search_path = public;

ALTER FUNCTION public.sync_space_type_rates_to_spaces_v2()
  SET search_path = public;

ALTER FUNCTION public.sync_rates_to_office_spaces()
  SET search_path = public;

-- =============================================================================
-- 5. Remove unused indexes
-- =============================================================================

DROP INDEX IF EXISTS idx_email_logs_sent_at;
DROP INDEX IF EXISTS idx_email_logs_to_email;
DROP INDEX IF EXISTS idx_email_logs_credit_note_id;
DROP INDEX IF EXISTS idx_invoice_line_items_booking_id;
DROP INDEX IF EXISTS idx_leases_tenant_id;
DROP INDEX IF EXISTS idx_meeting_room_bookings_recurring_pattern_id;
DROP INDEX IF EXISTS idx_lease_spaces_space_id;
DROP INDEX IF EXISTS idx_meter_groups_tenant_id;
DROP INDEX IF EXISTS idx_admin_notifications_is_read;
