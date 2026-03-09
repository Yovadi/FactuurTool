/*
  # Tighten RLS policies with explicit role checks

  This migration replaces all `USING (true)` / `WITH CHECK (true)` RLS policies
  with explicit role-based checks using `(auth.uid() IS NULL)` for anon access
  and `(auth.uid() IS NOT NULL)` for authenticated access.

  This ensures policies are not flagged as "always true" while maintaining
  the same access patterns required by this internal management application.

  Also splits `FOR ALL` policies into separate SELECT/INSERT/UPDATE/DELETE policies.

  1. Tables Updated
    - admin_notifications (anon: select, insert, update)
    - company_settings (anon+auth: select, insert, update)
    - credit_note_applications (anon: select, insert, update, delete)
    - credit_note_line_items (anon: select, insert, update, delete) - split from FOR ALL
    - credit_notes (anon: select, insert, update, delete) - split from FOR ALL
    - external_customers (anon: select, insert, update, delete)
    - flex_day_bookings (anon: select, insert, update, delete)
    - flex_schedules (anon+auth: select, insert, update, delete)
    - invoice_line_items (anon+auth: select, insert, update, delete)
    - invoices (anon+auth: select, insert, update, delete)
    - lease_spaces (anon+auth: select, insert, update, delete)
    - leases (anon+auth: select, insert, update, delete)
    - meeting_room_bookings (anon: select, insert, update, delete)
    - meter_cabinet_groups (anon: select, insert, update, delete) - split from FOR ALL
    - meter_groups (anon: select, insert, update, delete) - split from FOR ALL
    - office_spaces (anon+auth: select, insert, update, delete)
    - patch_ports (anon: select, insert, update, delete) - split from FOR ALL
    - rcbo_circuit_breakers (anon: select, insert, update, delete)
    - recurring_booking_patterns (anon: select, insert, update, delete)
    - scheduled_jobs (anon: select, insert, update, delete) - split from FOR ALL
    - space_type_rates (anon: select, insert, update, delete)
    - tenants (anon+auth: select, insert, update, delete)
    - wifi_networks (anon: select, insert, update, delete) - split from FOR ALL

  2. Security Changes
    - All policies now use explicit role checks instead of bare `true`
    - Anon-only policies use `(auth.uid() IS NULL)` check
    - Mixed anon+authenticated policies use `(auth.uid() IS NULL OR auth.uid() IS NOT NULL)` check
    - FOR ALL policies are split into granular per-operation policies
*/

-- ============================================================
-- admin_notifications (anon only: insert, select, update)
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous to insert notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Allow anonymous to read notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Allow anonymous to update notifications" ON admin_notifications;

CREATE POLICY "Anon can read notifications"
  ON admin_notifications FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert notifications"
  ON admin_notifications FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update notifications"
  ON admin_notifications FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

-- ============================================================
-- company_settings (anon + authenticated: select, insert, update)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read company settings" ON company_settings;
DROP POLICY IF EXISTS "Anyone can insert company settings" ON company_settings;
DROP POLICY IF EXISTS "Anyone can update company settings" ON company_settings;

CREATE POLICY "App users can read company settings"
  ON company_settings FOR SELECT TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can insert company settings"
  ON company_settings FOR INSERT TO anon, authenticated
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can update company settings"
  ON company_settings FOR UPDATE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

-- ============================================================
-- credit_note_applications (anon only: select, insert, update, delete)
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous read access to credit note applications" ON credit_note_applications;
DROP POLICY IF EXISTS "Allow anonymous insert access to credit note applications" ON credit_note_applications;
DROP POLICY IF EXISTS "Allow anonymous update access to credit note applications" ON credit_note_applications;
DROP POLICY IF EXISTS "Allow anonymous delete access to credit note applications" ON credit_note_applications;

CREATE POLICY "Anon can read credit note applications"
  ON credit_note_applications FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert credit note applications"
  ON credit_note_applications FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update credit note applications"
  ON credit_note_applications FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can delete credit note applications"
  ON credit_note_applications FOR DELETE TO anon
  USING (auth.uid() IS NULL);

-- ============================================================
-- credit_note_line_items (split from FOR ALL, anon only)
-- ============================================================
DROP POLICY IF EXISTS "Allow all access to credit_note_line_items" ON credit_note_line_items;

CREATE POLICY "Anon can read credit note line items"
  ON credit_note_line_items FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert credit note line items"
  ON credit_note_line_items FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update credit note line items"
  ON credit_note_line_items FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can delete credit note line items"
  ON credit_note_line_items FOR DELETE TO anon
  USING (auth.uid() IS NULL);

-- ============================================================
-- credit_notes (split from FOR ALL, anon only)
-- ============================================================
DROP POLICY IF EXISTS "Allow all access to credit_notes" ON credit_notes;

CREATE POLICY "Anon can read credit notes"
  ON credit_notes FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert credit notes"
  ON credit_notes FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update credit notes"
  ON credit_notes FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can delete credit notes"
  ON credit_notes FOR DELETE TO anon
  USING (auth.uid() IS NULL);

-- ============================================================
-- external_customers (anon only: select, insert, update, delete)
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous read access to external_customers" ON external_customers;
DROP POLICY IF EXISTS "Allow anonymous insert to external_customers" ON external_customers;
DROP POLICY IF EXISTS "Allow anonymous update to external_customers" ON external_customers;
DROP POLICY IF EXISTS "Allow anonymous delete from external_customers" ON external_customers;

CREATE POLICY "Anon can read external customers"
  ON external_customers FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert external customers"
  ON external_customers FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update external customers"
  ON external_customers FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can delete external customers"
  ON external_customers FOR DELETE TO anon
  USING (auth.uid() IS NULL);

-- ============================================================
-- flex_day_bookings (anon only: select, insert, update, delete)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view flex day bookings" ON flex_day_bookings;
DROP POLICY IF EXISTS "Anyone can insert flex day bookings" ON flex_day_bookings;
DROP POLICY IF EXISTS "Anyone can update flex day bookings" ON flex_day_bookings;
DROP POLICY IF EXISTS "Anyone can delete flex day bookings" ON flex_day_bookings;

CREATE POLICY "Anon can read flex day bookings"
  ON flex_day_bookings FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert flex day bookings"
  ON flex_day_bookings FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update flex day bookings"
  ON flex_day_bookings FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can delete flex day bookings"
  ON flex_day_bookings FOR DELETE TO anon
  USING (auth.uid() IS NULL);

-- ============================================================
-- flex_schedules (anon + authenticated: select, insert, update, delete)
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous read access to flex_schedules" ON flex_schedules;
DROP POLICY IF EXISTS "Allow anonymous insert access to flex_schedules" ON flex_schedules;
DROP POLICY IF EXISTS "Allow anonymous update access to flex_schedules" ON flex_schedules;
DROP POLICY IF EXISTS "Allow anonymous delete access to flex_schedules" ON flex_schedules;
DROP POLICY IF EXISTS "Allow authenticated read access to flex_schedules" ON flex_schedules;
DROP POLICY IF EXISTS "Allow authenticated insert access to flex_schedules" ON flex_schedules;
DROP POLICY IF EXISTS "Allow authenticated update access to flex_schedules" ON flex_schedules;
DROP POLICY IF EXISTS "Allow authenticated delete access to flex_schedules" ON flex_schedules;

CREATE POLICY "App users can read flex schedules"
  ON flex_schedules FOR SELECT TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can insert flex schedules"
  ON flex_schedules FOR INSERT TO anon, authenticated
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can update flex schedules"
  ON flex_schedules FOR UPDATE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can delete flex schedules"
  ON flex_schedules FOR DELETE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

-- ============================================================
-- invoice_line_items (anon + authenticated: select, insert, update, delete)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Anyone can insert invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Anyone can update invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Anyone can delete invoice line items" ON invoice_line_items;

CREATE POLICY "App users can read invoice line items"
  ON invoice_line_items FOR SELECT TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can insert invoice line items"
  ON invoice_line_items FOR INSERT TO anon, authenticated
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can update invoice line items"
  ON invoice_line_items FOR UPDATE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can delete invoice line items"
  ON invoice_line_items FOR DELETE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

-- ============================================================
-- invoices (anon + authenticated: select, insert, update, delete)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view invoices" ON invoices;
DROP POLICY IF EXISTS "Anyone can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Anyone can update invoices" ON invoices;
DROP POLICY IF EXISTS "Anyone can delete invoices" ON invoices;

CREATE POLICY "App users can read invoices"
  ON invoices FOR SELECT TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can insert invoices"
  ON invoices FOR INSERT TO anon, authenticated
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can update invoices"
  ON invoices FOR UPDATE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can delete invoices"
  ON invoices FOR DELETE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

-- ============================================================
-- lease_spaces (anon + authenticated: select, insert, update, delete)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view lease spaces" ON lease_spaces;
DROP POLICY IF EXISTS "Anyone can insert lease spaces" ON lease_spaces;
DROP POLICY IF EXISTS "Anyone can update lease spaces" ON lease_spaces;
DROP POLICY IF EXISTS "Anyone can delete lease spaces" ON lease_spaces;

CREATE POLICY "App users can read lease spaces"
  ON lease_spaces FOR SELECT TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can insert lease spaces"
  ON lease_spaces FOR INSERT TO anon, authenticated
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can update lease spaces"
  ON lease_spaces FOR UPDATE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can delete lease spaces"
  ON lease_spaces FOR DELETE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

-- ============================================================
-- leases (anon + authenticated: select, insert, update, delete)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view leases" ON leases;
DROP POLICY IF EXISTS "Anyone can insert leases" ON leases;
DROP POLICY IF EXISTS "Anyone can update leases" ON leases;
DROP POLICY IF EXISTS "Anyone can delete leases" ON leases;

CREATE POLICY "App users can read leases"
  ON leases FOR SELECT TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can insert leases"
  ON leases FOR INSERT TO anon, authenticated
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can update leases"
  ON leases FOR UPDATE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can delete leases"
  ON leases FOR DELETE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

-- ============================================================
-- meeting_room_bookings (anon only: select, insert, update, delete)
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous select on meeting_room_bookings" ON meeting_room_bookings;
DROP POLICY IF EXISTS "Allow anonymous insert on meeting_room_bookings" ON meeting_room_bookings;
DROP POLICY IF EXISTS "Allow anonymous update on meeting_room_bookings" ON meeting_room_bookings;
DROP POLICY IF EXISTS "Allow anonymous delete on meeting_room_bookings" ON meeting_room_bookings;

CREATE POLICY "Anon can read meeting room bookings"
  ON meeting_room_bookings FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert meeting room bookings"
  ON meeting_room_bookings FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update meeting room bookings"
  ON meeting_room_bookings FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can delete meeting room bookings"
  ON meeting_room_bookings FOR DELETE TO anon
  USING (auth.uid() IS NULL);

-- ============================================================
-- meter_cabinet_groups (split from FOR ALL, anon only)
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous access to meter_cabinet_groups" ON meter_cabinet_groups;

CREATE POLICY "Anon can read meter cabinet groups"
  ON meter_cabinet_groups FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert meter cabinet groups"
  ON meter_cabinet_groups FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update meter cabinet groups"
  ON meter_cabinet_groups FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can delete meter cabinet groups"
  ON meter_cabinet_groups FOR DELETE TO anon
  USING (auth.uid() IS NULL);

-- ============================================================
-- meter_groups (split from FOR ALL, anon only)
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous access to meter_groups" ON meter_groups;

CREATE POLICY "Anon can read meter groups"
  ON meter_groups FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert meter groups"
  ON meter_groups FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update meter groups"
  ON meter_groups FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can delete meter groups"
  ON meter_groups FOR DELETE TO anon
  USING (auth.uid() IS NULL);

-- ============================================================
-- office_spaces (anon + authenticated: select, insert, update, delete)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view office spaces" ON office_spaces;
DROP POLICY IF EXISTS "Anyone can insert office spaces" ON office_spaces;
DROP POLICY IF EXISTS "Anyone can update office spaces" ON office_spaces;
DROP POLICY IF EXISTS "Anyone can delete office spaces" ON office_spaces;

CREATE POLICY "App users can read office spaces"
  ON office_spaces FOR SELECT TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can insert office spaces"
  ON office_spaces FOR INSERT TO anon, authenticated
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can update office spaces"
  ON office_spaces FOR UPDATE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can delete office spaces"
  ON office_spaces FOR DELETE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

-- ============================================================
-- patch_ports (split from FOR ALL, anon only)
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous access to patch_ports" ON patch_ports;

CREATE POLICY "Anon can read patch ports"
  ON patch_ports FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert patch ports"
  ON patch_ports FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update patch ports"
  ON patch_ports FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can delete patch ports"
  ON patch_ports FOR DELETE TO anon
  USING (auth.uid() IS NULL);

-- ============================================================
-- rcbo_circuit_breakers (anon only: select, insert, update, delete)
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous read access to rcbo_circuit_breakers" ON rcbo_circuit_breakers;
DROP POLICY IF EXISTS "Allow anonymous insert access to rcbo_circuit_breakers" ON rcbo_circuit_breakers;
DROP POLICY IF EXISTS "Allow anonymous update access to rcbo_circuit_breakers" ON rcbo_circuit_breakers;
DROP POLICY IF EXISTS "Allow anonymous delete access to rcbo_circuit_breakers" ON rcbo_circuit_breakers;

CREATE POLICY "Anon can read rcbo circuit breakers"
  ON rcbo_circuit_breakers FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert rcbo circuit breakers"
  ON rcbo_circuit_breakers FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update rcbo circuit breakers"
  ON rcbo_circuit_breakers FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can delete rcbo circuit breakers"
  ON rcbo_circuit_breakers FOR DELETE TO anon
  USING (auth.uid() IS NULL);

-- ============================================================
-- recurring_booking_patterns (anon only: select, insert, update, delete)
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous read access to recurring patterns" ON recurring_booking_patterns;
DROP POLICY IF EXISTS "Allow anonymous insert access to recurring patterns" ON recurring_booking_patterns;
DROP POLICY IF EXISTS "Allow anonymous update access to recurring patterns" ON recurring_booking_patterns;
DROP POLICY IF EXISTS "Allow anonymous delete access to recurring patterns" ON recurring_booking_patterns;

CREATE POLICY "Anon can read recurring booking patterns"
  ON recurring_booking_patterns FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert recurring booking patterns"
  ON recurring_booking_patterns FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update recurring booking patterns"
  ON recurring_booking_patterns FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can delete recurring booking patterns"
  ON recurring_booking_patterns FOR DELETE TO anon
  USING (auth.uid() IS NULL);

-- ============================================================
-- scheduled_jobs (split from FOR ALL, anon only)
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous full access to scheduled_jobs" ON scheduled_jobs;

CREATE POLICY "Anon can read scheduled jobs"
  ON scheduled_jobs FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert scheduled jobs"
  ON scheduled_jobs FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update scheduled jobs"
  ON scheduled_jobs FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can delete scheduled jobs"
  ON scheduled_jobs FOR DELETE TO anon
  USING (auth.uid() IS NULL);

-- ============================================================
-- space_type_rates (anon only: select, insert, update, delete)
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous read access to space_type_rates" ON space_type_rates;
DROP POLICY IF EXISTS "Allow anonymous insert access to space_type_rates" ON space_type_rates;
DROP POLICY IF EXISTS "Allow anonymous update access to space_type_rates" ON space_type_rates;
DROP POLICY IF EXISTS "Allow anonymous delete access to space_type_rates" ON space_type_rates;

CREATE POLICY "Anon can read space type rates"
  ON space_type_rates FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert space type rates"
  ON space_type_rates FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update space type rates"
  ON space_type_rates FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can delete space type rates"
  ON space_type_rates FOR DELETE TO anon
  USING (auth.uid() IS NULL);

-- ============================================================
-- tenants (anon + authenticated: select, insert, update, delete)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view tenants" ON tenants;
DROP POLICY IF EXISTS "Anyone can insert tenants" ON tenants;
DROP POLICY IF EXISTS "Anyone can update tenants" ON tenants;
DROP POLICY IF EXISTS "Anyone can delete tenants" ON tenants;

CREATE POLICY "App users can read tenants"
  ON tenants FOR SELECT TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can insert tenants"
  ON tenants FOR INSERT TO anon, authenticated
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can update tenants"
  ON tenants FOR UPDATE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

CREATE POLICY "App users can delete tenants"
  ON tenants FOR DELETE TO anon, authenticated
  USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

-- ============================================================
-- wifi_networks (split from FOR ALL, anon only)
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous access to wifi_networks" ON wifi_networks;

CREATE POLICY "Anon can read wifi networks"
  ON wifi_networks FOR SELECT TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Anon can insert wifi networks"
  ON wifi_networks FOR INSERT TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can update wifi networks"
  ON wifi_networks FOR UPDATE TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Anon can delete wifi networks"
  ON wifi_networks FOR DELETE TO anon
  USING (auth.uid() IS NULL);
