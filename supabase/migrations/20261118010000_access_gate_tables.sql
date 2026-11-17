/*
  Voorbereiding voor het afschermen van de database.

  Dit script laat de app en de boekingspagina werken zoals nu.
  Het maakt alleen tabellen die de nieuwe pincode-controle nodig heeft.
  Die tabellen zijn voor de publieke sleutel niet leesbaar.

  Plak dit vóór het sluitscript 20261118020000_close_anon_access.sql.
*/

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS staff_gate_ready boolean NOT NULL DEFAULT false;

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS booking_gate_ready boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS access_gate_secrets (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  staff_password text NOT NULL,
  auth_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booker_credentials (
  customer_id uuid PRIMARY KEY,
  customer_type text NOT NULL CHECK (customer_type IN ('tenant', 'external')),
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  auth_user_id uuid
);

CREATE TABLE IF NOT EXISTS pin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE access_gate_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE booker_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_attempts ENABLE ROW LEVEL SECURITY;
