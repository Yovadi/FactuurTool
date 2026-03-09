/*
  # Drop unused indexes

  1. Removed Indexes
    - `idx_credit_notes_external_customer_id` on `credit_notes` - not used by any queries
    - `idx_flex_schedules_external_customer_id` on `flex_schedules` - not used by any queries
    - `idx_flex_day_bookings_external_customer_id` on `flex_day_bookings` - not used by any queries
    - `idx_flex_day_bookings_invoice_id` on `flex_day_bookings` - not used by any queries
    - `idx_purchase_invoice_line_items_purchase_invoice_id` on `purchase_invoice_line_items` - not used by any queries
    - `idx_admin_notifications_external_customer_id` on `admin_notifications` - not used by any queries
    - `idx_admin_notifications_tenant_id` on `admin_notifications` - not used by any queries

  2. Notes
    - These indexes have zero usage according to pg_stat_user_indexes
    - Removing unused indexes reduces write overhead and storage
    - Can be re-added if query patterns change in the future
*/

DROP INDEX IF EXISTS idx_credit_notes_external_customer_id;
DROP INDEX IF EXISTS idx_flex_schedules_external_customer_id;
DROP INDEX IF EXISTS idx_flex_day_bookings_external_customer_id;
DROP INDEX IF EXISTS idx_flex_day_bookings_invoice_id;
DROP INDEX IF EXISTS idx_purchase_invoice_line_items_purchase_invoice_id;
DROP INDEX IF EXISTS idx_admin_notifications_external_customer_id;
DROP INDEX IF EXISTS idx_admin_notifications_tenant_id;
