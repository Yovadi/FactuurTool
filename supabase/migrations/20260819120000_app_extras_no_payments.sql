/*
  Extra app features (no payment providers).

  - Prevent overlapping meeting-room bookings
  - Waiting list
  - Audit log
  - Settings backups without secrets
  - Staff unlock PIN and Outlook calendar sync flag
  - Invoice reminder tracking
  - Scheduled jobs for reminders and backups
*/

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS staff_pin_code text,
  ADD COLUMN IF NOT EXISTS calendar_sync_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;

ALTER TABLE meeting_room_bookings
  ADD COLUMN IF NOT EXISTS outlook_event_id text;

CREATE OR REPLACE FUNCTION prevent_meeting_room_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM meeting_room_bookings b
    WHERE b.space_id = NEW.space_id
      AND b.booking_date = NEW.booking_date
      AND b.status IS DISTINCT FROM 'cancelled'
      AND b.id IS DISTINCT FROM NEW.id
      AND NEW.start_time < b.end_time
      AND NEW.end_time > b.start_time
  ) THEN
    RAISE EXCEPTION 'Deze ruimte is al geboekt voor het gekozen tijdslot';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meeting_room_no_overlap ON meeting_room_bookings;
CREATE TRIGGER trg_meeting_room_no_overlap
  BEFORE INSERT OR UPDATE OF space_id, booking_date, start_time, end_time, status
  ON meeting_room_bookings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_meeting_room_overlap();

CREATE TABLE IF NOT EXISTS booking_waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES office_spaces(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  external_customer_id uuid REFERENCES external_customers(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waiting_list_space_date
  ON booking_waiting_list (space_id, booking_date, status);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);

CREATE TABLE IF NOT EXISTS settings_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE booking_waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous all on booking_waiting_list" ON booking_waiting_list;
CREATE POLICY "Allow anonymous all on booking_waiting_list"
  ON booking_waiting_list FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous all on audit_log" ON audit_log;
CREATE POLICY "Allow anonymous all on audit_log"
  ON audit_log FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous all on settings_backups" ON settings_backups;
CREATE POLICY "Allow anonymous all on settings_backups"
  ON settings_backups FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

INSERT INTO scheduled_jobs (job_type, is_enabled, next_run_at)
VALUES
  ('send_invoice_reminders', true, now() + interval '1 hour'),
  ('settings_backup', true, now() + interval '1 hour')
ON CONFLICT (job_type) DO NOTHING;
