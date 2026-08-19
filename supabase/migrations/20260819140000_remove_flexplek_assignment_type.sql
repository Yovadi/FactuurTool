/*
  Remove leftover Flexplek assignment type from building resources.

  Vergaderruimte / spreekkamer stays. Existing Flexplek assignments
  are remapped to eigen gebruik. The unused generate_flex_invoices
  scheduled job is deleted.
*/

UPDATE wifi_networks
SET assignment_type = 'eigen'
WHERE assignment_type = 'flexplek';

UPDATE patch_ports
SET assignment_type = 'eigen'
WHERE assignment_type = 'flexplek';

UPDATE meter_groups
SET assignment_type = 'eigen'
WHERE assignment_type = 'flexplek';

UPDATE rcbo_circuit_breakers
SET assignment_type = 'eigen'
WHERE assignment_type = 'flexplek';

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
      AND rel.relname IN ('wifi_networks', 'patch_ports', 'meter_groups', 'rcbo_circuit_breakers')
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%assignment_type%'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', rec.relname, rec.conname);
  END LOOP;
END $$;

ALTER TABLE wifi_networks
  DROP CONSTRAINT IF EXISTS wifi_networks_assignment_type_check;
ALTER TABLE patch_ports
  DROP CONSTRAINT IF EXISTS patch_ports_assignment_type_check;
ALTER TABLE meter_groups
  DROP CONSTRAINT IF EXISTS meter_groups_assignment_type_check;
ALTER TABLE rcbo_circuit_breakers
  DROP CONSTRAINT IF EXISTS rcbo_circuit_breakers_assignment_type_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wifi_networks_assignment_type_check'
  ) THEN
    ALTER TABLE wifi_networks
      ADD CONSTRAINT wifi_networks_assignment_type_check
      CHECK (assignment_type IN ('eigen', 'huurder', 'spreekkamer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patch_ports_assignment_type_check'
  ) THEN
    ALTER TABLE patch_ports
      ADD CONSTRAINT patch_ports_assignment_type_check
      CHECK (assignment_type IN ('eigen', 'huurder', 'spreekkamer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meter_groups_assignment_type_check'
  ) THEN
    ALTER TABLE meter_groups
      ADD CONSTRAINT meter_groups_assignment_type_check
      CHECK (assignment_type IN ('eigen', 'huurder', 'spreekkamer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rcbo_circuit_breakers_assignment_type_check'
  ) THEN
    ALTER TABLE rcbo_circuit_breakers
      ADD CONSTRAINT rcbo_circuit_breakers_assignment_type_check
      CHECK (assignment_type IN ('eigen', 'huurder', 'spreekkamer'));
  END IF;
END $$;

DELETE FROM scheduled_jobs
WHERE job_type = 'generate_flex_invoices';
