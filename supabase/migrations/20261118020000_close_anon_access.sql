/*
  Dit script sluit de open database.

  De publieke sleutel kan daarna geen facturen, wachtwoorden of huurderslijst meer lezen.
  Medewerkers houden dezelfde personeels-PIN. Huurders houden dezelfde boekingspincode.

  Plak dit pas nadat alles hieronder klaar is. Ontbreekt er iets, dan stopt het script
  en verandert het niets.

  1. 20261118010000_access_gate_tables.sql is geplakt.
  2. De functies staff-session en booker-session zijn in Supabase gepubliceerd.
  3. De nieuwe app is één keer geopend met de personeels-PIN.
  4. De nieuwe boekingspagina is één keer geopend met een boekingspincode.
  5. GitHub heeft het geheim SUPABASE_SERVICE_ROLE_KEY, anders stopt de uurtaak.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM company_settings
    WHERE staff_gate_ready IS TRUE
      AND booking_gate_ready IS TRUE
  ) THEN
    RAISE EXCEPTION 'Stop. Open eerst de nieuwe app en de nieuwe boekingspagina een keer met de juiste pincode. Er is niets gewijzigd.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'app_role', '');
$$;

CREATE OR REPLACE FUNCTION booker_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(auth.jwt() -> 'app_metadata' ->> 'customer_id', '')::uuid;
$$;

GRANT EXECUTE ON FUNCTION app_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION booker_customer_id() TO anon, authenticated;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, policy_row.tablename);
  END LOOP;
END $$;

DO $$
DECLARE
  table_row record;
BEGIN
  FOR table_row IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('access_gate_secrets', 'booker_credentials', 'pin_attempts')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_row.tablename);
    EXECUTE format(
      'CREATE POLICY "Staff full access" ON public.%I FOR ALL TO authenticated USING (app_role() = ''staff'') WITH CHECK (app_role() = ''staff'')',
      table_row.tablename
    );
  END LOOP;
END $$;

ALTER TABLE access_gate_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE booker_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booker reads meeting rooms"
  ON office_spaces FOR SELECT TO authenticated
  USING (app_role() = 'booker' AND space_type = 'Meeting Room');

CREATE POLICY "Booker reads bookings"
  ON meeting_room_bookings FOR SELECT TO authenticated
  USING (app_role() = 'booker');

CREATE POLICY "Booker inserts own booking"
  ON meeting_room_bookings FOR INSERT TO authenticated
  WITH CHECK (
    app_role() = 'booker'
    AND (
      (tenant_id = booker_customer_id() AND external_customer_id IS NULL)
      OR (external_customer_id = booker_customer_id() AND tenant_id IS NULL)
    )
  );

CREATE POLICY "Booker updates own booking"
  ON meeting_room_bookings FOR UPDATE TO authenticated
  USING (
    app_role() = 'booker'
    AND (tenant_id = booker_customer_id() OR external_customer_id = booker_customer_id())
  )
  WITH CHECK (
    app_role() = 'booker'
    AND (
      (tenant_id = booker_customer_id() AND external_customer_id IS NULL)
      OR (external_customer_id = booker_customer_id() AND tenant_id IS NULL)
    )
  );

CREATE POLICY "Booker reads own pattern"
  ON recurring_booking_patterns FOR SELECT TO authenticated
  USING (app_role() = 'booker' AND tenant_id = booker_customer_id());

CREATE POLICY "Booker inserts own pattern"
  ON recurring_booking_patterns FOR INSERT TO authenticated
  WITH CHECK (app_role() = 'booker' AND tenant_id = booker_customer_id());

CREATE POLICY "Booker joins waiting list"
  ON booking_waiting_list FOR INSERT TO authenticated
  WITH CHECK (
    app_role() = 'booker'
    AND (
      (tenant_id = booker_customer_id() AND external_customer_id IS NULL)
      OR (external_customer_id = booker_customer_id() AND tenant_id IS NULL)
    )
  );
