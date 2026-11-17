/*
  # Enable Realtime for tenants, leases, and lease_spaces

  1. Changes
    - Enable REPLICA IDENTITY FULL for tenants, leases, lease_spaces
    - Add tables to supabase_realtime publication

  2. Purpose
    - Allow the app to refresh huurders/contracten lists when data changes
      without requiring an app restart (tabs stay mounted via visitedTabs)
*/

ALTER TABLE tenants REPLICA IDENTITY FULL;
ALTER TABLE leases REPLICA IDENTITY FULL;
ALTER TABLE lease_spaces REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'tenants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tenants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'leases'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE leases;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'lease_spaces'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lease_spaces;
  END IF;
END $$;
