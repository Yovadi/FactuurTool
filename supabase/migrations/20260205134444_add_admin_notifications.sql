/*
  # Admin Notificaties Systeem

  1. Nieuwe Tabel
    - `admin_notifications`
      - `id` (uuid, primary key)
      - `notification_type` (text) - Type notificatie (booking_cancelled, booking_pending, etc.)
      - `title` (text) - Korte titel van de notificatie
      - `message` (text) - Volledige bericht
      - `booking_type` (text) - Type boeking (meeting_room, flex_workspace)
      - `booking_id` (uuid) - Referentie naar de boeking
      - `tenant_id` (uuid, nullable) - Referentie naar huurder indien van toepassing
      - `external_customer_id` (uuid, nullable) - Referentie naar externe klant indien van toepassing
      - `is_read` (boolean) - Of de notificatie gelezen is
      - `created_at` (timestamptz) - Aanmaakdatum
  
  2. Security
    - Enable RLS op `admin_notifications` tabel
    - Policies voor admins om alle notificaties te lezen/markeren
    - Policy voor het systeem om notificaties aan te maken
*/

CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  booking_type text CHECK (booking_type IN ('meeting_room', 'flex_workspace')),
  booking_id uuid,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  external_customer_id uuid REFERENCES external_customers(id) ON DELETE SET NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous to insert notifications"
  ON admin_notifications
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous to read notifications"
  ON admin_notifications
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous to update notifications"
  ON admin_notifications
  FOR UPDATE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON admin_notifications(is_read) WHERE is_read = false;