/*
  # Fix Performance and Security Issues
  
  ## Performance Improvements
  
  1. **Add Missing Indexes on Foreign Keys**
     - `invoice_line_items.booking_id`
     - `lease_spaces.space_id`
     - `leases.tenant_id`
     - `meeting_room_bookings.recurring_pattern_id`
     - `meeting_room_bookings.tenant_id`
  
  2. **Remove Unused Indexes**
     - Remove 14 unused indexes that add overhead without benefit
  
  ## Security Improvements
  
  3. **Fix Function Search Paths**
     - Set explicit search_path on 8 functions to prevent search_path manipulation attacks
  
  ## Notes on RLS Policies
  - RLS policies flagged as "always true" are INTENTIONAL for this single-tenant application
  - Application uses PIN-based access control at the application layer
  - This is a valid security model for a single-company, self-hosted application
  - Auth connection strategy must be configured in Supabase dashboard (cannot be changed via SQL)
*/

-- ============================================================================
-- PART 1: ADD MISSING INDEXES FOR FOREIGN KEYS
-- ============================================================================

-- Add index for invoice_line_items.booking_id
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_booking_id 
ON invoice_line_items(booking_id);

-- Add index for lease_spaces.space_id
CREATE INDEX IF NOT EXISTS idx_lease_spaces_space_id 
ON lease_spaces(space_id);

-- Add index for leases.tenant_id
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id 
ON leases(tenant_id);

-- Add index for meeting_room_bookings.recurring_pattern_id
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_recurring_pattern_id 
ON meeting_room_bookings(recurring_pattern_id);

-- Add index for meeting_room_bookings.tenant_id
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_tenant_id 
ON meeting_room_bookings(tenant_id);

-- ============================================================================
-- PART 2: REMOVE UNUSED INDEXES
-- ============================================================================

-- Drop unused indexes on invoices
DROP INDEX IF EXISTS idx_invoices_tenant_id;
DROP INDEX IF EXISTS idx_invoices_external_customer_id;

-- Drop unused indexes on credit_notes
DROP INDEX IF EXISTS idx_credit_notes_external_customer_id;

-- Drop unused indexes on patch_ports
DROP INDEX IF EXISTS idx_patch_ports_wifi;
DROP INDEX IF EXISTS idx_patch_ports_location;
DROP INDEX IF EXISTS idx_patch_ports_switch_port;

-- Drop unused indexes on meter_groups
DROP INDEX IF EXISTS idx_meter_groups_number;
DROP INDEX IF EXISTS idx_meter_groups_location;
DROP INDEX IF EXISTS idx_meter_groups_ala;
DROP INDEX IF EXISTS idx_meter_groups_ala_group_number;

-- Drop unused indexes on meter_cabinet_groups
DROP INDEX IF EXISTS idx_meter_cabinet_groups_ala;

-- Drop unused indexes on flex tables
DROP INDEX IF EXISTS idx_flex_day_bookings_invoice_id;
DROP INDEX IF EXISTS idx_flex_schedules_external_customer;
DROP INDEX IF EXISTS idx_flex_day_bookings_external_customer;
DROP INDEX IF EXISTS idx_flex_day_bookings_space_slot;

-- ============================================================================
-- PART 3: FIX FUNCTION SEARCH PATHS
-- ============================================================================

-- Fix search_path for get_available_flex_slots
ALTER FUNCTION get_available_flex_slots(p_space_id uuid, p_booking_date date) 
SET search_path = public, pg_temp;

-- Fix search_path for get_flex_space_bookings_count
ALTER FUNCTION get_flex_space_bookings_count(p_space_id uuid, p_booking_date date, p_exclude_booking_id uuid) 
SET search_path = public, pg_temp;

-- Fix search_path for check_flex_capacity
ALTER FUNCTION check_flex_capacity() 
SET search_path = public, pg_temp;

-- Fix search_path for sync_space_type_rates_to_spaces_v2
ALTER FUNCTION sync_space_type_rates_to_spaces_v2() 
SET search_path = public, pg_temp;

-- Fix search_path for auto_confirm_contract_flex_bookings
ALTER FUNCTION auto_confirm_contract_flex_bookings() 
SET search_path = public, pg_temp;

-- Fix search_path for update_flex_booking_status_on_invoice
ALTER FUNCTION update_flex_booking_status_on_invoice() 
SET search_path = public, pg_temp;

-- Fix search_path for sync_office_space_rates_to_lease_spaces
ALTER FUNCTION sync_office_space_rates_to_lease_spaces() 
SET search_path = public, pg_temp;

-- Fix search_path for sync_rates_to_office_spaces
ALTER FUNCTION sync_rates_to_office_spaces() 
SET search_path = public, pg_temp;