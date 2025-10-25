/*
  # Add invoice status and automatic scheduling

  1. Changes to invoices table
    - Add `status` column with values: 'concept', 'sent', 'paid'
    - Add `sent_at` timestamp to track when invoice was sent
    - Add `paid_at` timestamp to track when invoice was paid
    - Set default status to 'concept' for new invoices

  2. New table: scheduled_jobs
    - `id` (uuid, primary key)
    - `job_type` (text) - type of job (e.g., 'generate_monthly_invoices')
    - `last_run_at` (timestamptz) - when job last ran
    - `next_run_at` (timestamptz) - when job should run next
    - `is_enabled` (boolean) - whether job is active
    - `created_at` (timestamptz)

  3. Security
    - Enable RLS on scheduled_jobs table
    - Add policies for anonymous access (since this is a local app)
*/

-- Add status columns to invoices table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'status'
  ) THEN
    ALTER TABLE invoices ADD COLUMN status text DEFAULT 'sent' CHECK (status IN ('concept', 'sent', 'paid'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'sent_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN sent_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN paid_at timestamptz;
  END IF;
END $$;

-- Update existing invoices to have 'sent' status
UPDATE invoices SET status = 'sent' WHERE status IS NULL;

-- Create scheduled_jobs table
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL UNIQUE,
  last_run_at timestamptz,
  next_run_at timestamptz,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous full access to scheduled_jobs"
  ON scheduled_jobs
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Insert the monthly invoice generation job
INSERT INTO scheduled_jobs (job_type, next_run_at, is_enabled)
VALUES (
  'generate_monthly_invoices',
  date_trunc('month', now() + interval '1 month') + interval '0 days',
  true
)
ON CONFLICT (job_type) DO NOTHING;