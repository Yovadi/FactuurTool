/*
  Haal de onafgemaakte flexplek uit de database.

  Ruimtes met type Flexplek worden kantoor. Een flex-contract wordt een
  gewoon huurcontract. Zaalboekingen met type flex worden een huurdersboeking.
  De tabellen voor flexdagen en flexroosters gaan weg. Huur, zalen en
  facturen blijven staan.
*/

UPDATE office_spaces
SET space_type = 'kantoor'
WHERE space_type = 'Flexplek';

DELETE FROM space_type_rates
WHERE space_type = 'Flexplek';

UPDATE leases
SET lease_type = 'full_time'
WHERE lease_type = 'flex';

UPDATE meeting_room_bookings
SET booking_type = 'tenant'
WHERE booking_type = 'flex';

DO $$
BEGIN
  IF to_regclass('public.admin_notifications') IS NOT NULL THEN
    UPDATE admin_notifications
    SET booking_type = NULL
    WHERE booking_type = 'flex_workspace';
  END IF;

  IF to_regclass('public.eboekhouden_grootboek_mapping') IS NOT NULL THEN
    DELETE FROM eboekhouden_grootboek_mapping
    WHERE local_category = 'flexplek';
  END IF;
END $$;

DELETE FROM scheduled_jobs
WHERE job_type = 'generate_flex_invoices';

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT con.conname, rel.relname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND con.contype = 'c'
      AND (
        (rel.relname = 'office_spaces' AND pg_get_constraintdef(con.oid) ILIKE '%Flexplek%')
        OR (rel.relname = 'leases' AND pg_get_constraintdef(con.oid) ILIKE '%flex%')
        OR (rel.relname = 'meeting_room_bookings' AND pg_get_constraintdef(con.oid) ILIKE '%flex%')
        OR (rel.relname = 'admin_notifications' AND pg_get_constraintdef(con.oid) ILIKE '%flex_workspace%')
      )
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', rec.relname, rec.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'office_spaces_space_type_check'
  ) THEN
    ALTER TABLE office_spaces
      ADD CONSTRAINT office_spaces_space_type_check
      CHECK (space_type IN ('bedrijfsruimte', 'kantoor', 'buitenterrein', 'diversen', 'Meeting Room'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leases_lease_type_check'
  ) THEN
    ALTER TABLE leases
      ADD CONSTRAINT leases_lease_type_check
      CHECK (lease_type IN ('full_time', 'part_time'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meeting_room_bookings_booking_type_check'
  ) THEN
    ALTER TABLE meeting_room_bookings
      ADD CONSTRAINT meeting_room_bookings_booking_type_check
      CHECK (booking_type IN ('tenant', 'external'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_booking_type_consistency'
  ) THEN
    ALTER TABLE meeting_room_bookings
      ADD CONSTRAINT check_booking_type_consistency CHECK (
        (booking_type = 'tenant' AND tenant_id IS NOT NULL AND external_customer_id IS NULL) OR
        (booking_type = 'external' AND external_customer_id IS NOT NULL AND tenant_id IS NULL)
      );
  END IF;

  IF to_regclass('public.admin_notifications') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'admin_notifications_booking_type_check'
     ) THEN
    ALTER TABLE admin_notifications
      ADD CONSTRAINT admin_notifications_booking_type_check
      CHECK (booking_type IS NULL OR booking_type = 'meeting_room');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION sync_space_type_rates_to_spaces_v2()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.space_type = 'kantoor' AND (NEW.calculation_method = 'per_sqm' OR NEW.calculation_method = 'custom') THEN
    UPDATE office_spaces
    SET rate_per_sqm = CASE
      WHEN is_furnished = true AND NEW.rate_per_sqm_furnished > 0 THEN NEW.rate_per_sqm_furnished
      ELSE NEW.rate_per_sqm
    END
    WHERE space_type = 'kantoor'
      AND (
        rate_per_sqm IS NULL
        OR rate_per_sqm = OLD.rate_per_sqm
        OR (is_furnished = true AND rate_per_sqm = OLD.rate_per_sqm_furnished)
      );

    UPDATE lease_spaces ls
    SET
      price_per_sqm = CASE
        WHEN os.is_furnished = true AND NEW.rate_per_sqm_furnished > 0 THEN NEW.rate_per_sqm_furnished
        ELSE NEW.rate_per_sqm
      END,
      monthly_rent = ROUND((os.square_footage * CASE
        WHEN os.is_furnished = true AND NEW.rate_per_sqm_furnished > 0 THEN NEW.rate_per_sqm_furnished
        ELSE NEW.rate_per_sqm
      END / 12)::numeric, 2)
    FROM office_spaces os
    INNER JOIN leases l ON l.id = ls.lease_id
    WHERE ls.space_id = os.id
      AND os.space_type = 'kantoor'
      AND l.lease_type = 'fixed'
      AND (
        ls.price_per_sqm IS NULL
        OR ls.price_per_sqm = OLD.rate_per_sqm
        OR (os.is_furnished = true AND ls.price_per_sqm = OLD.rate_per_sqm_furnished)
      );

  ELSIF (NEW.space_type = 'bedrijfsruimte' OR NEW.space_type = 'buitenterrein')
    AND (NEW.calculation_method = 'per_sqm' OR NEW.calculation_method = 'custom') THEN
    UPDATE office_spaces
    SET rate_per_sqm = NEW.rate_per_sqm
    WHERE space_type = NEW.space_type
      AND (rate_per_sqm IS NULL OR rate_per_sqm = OLD.rate_per_sqm);

    UPDATE lease_spaces ls
    SET
      price_per_sqm = NEW.rate_per_sqm,
      monthly_rent = ROUND((os.square_footage * NEW.rate_per_sqm / 12)::numeric, 2)
    FROM office_spaces os
    INNER JOIN leases l ON l.id = ls.lease_id
    WHERE ls.space_id = os.id
      AND os.space_type = NEW.space_type
      AND l.lease_type = 'fixed'
      AND (ls.price_per_sqm IS NULL OR ls.price_per_sqm = OLD.rate_per_sqm);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'flex_day_bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE flex_day_bookings;
  END IF;
END $$;

DROP TABLE IF EXISTS flex_day_bookings CASCADE;
DROP TABLE IF EXISTS flex_schedules CASCADE;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_flex_credits_used',
        'get_flex_credits_used_weekly',
        'check_flex_credit_limit',
        'get_available_flex_slots',
        'get_flex_space_bookings_count',
        'check_flex_capacity',
        'auto_confirm_contract_flex_bookings',
        'update_flex_booking_status_on_invoice'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', rec.signature);
  END LOOP;
END $$;

ALTER TABLE leases DROP COLUMN IF EXISTS flex_pricing_model;
ALTER TABLE leases DROP COLUMN IF EXISTS flex_daily_rate;
ALTER TABLE leases DROP COLUMN IF EXISTS flex_monthly_rate;
ALTER TABLE leases DROP COLUMN IF EXISTS flex_credit_rate;
ALTER TABLE leases DROP COLUMN IF EXISTS flex_day_type;
ALTER TABLE leases DROP COLUMN IF EXISTS flex_days_per_month;
ALTER TABLE leases DROP COLUMN IF EXISTS credits_per_week;

ALTER TABLE office_spaces DROP COLUMN IF EXISTS is_flex_space;
ALTER TABLE office_spaces DROP COLUMN IF EXISTS flex_capacity;
