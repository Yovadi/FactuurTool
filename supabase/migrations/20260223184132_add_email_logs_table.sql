/*
  # Create email_logs table for tracking sent emails

  1. New Tables
    - `email_logs`
      - `id` (uuid, primary key)
      - `to_email` (text, not null) - Recipient email address
      - `to_name` (text) - Recipient display name
      - `subject` (text, not null) - Email subject line
      - `body` (text) - Email body content
      - `method` (text, not null) - Sending method: smtp, graph, resend, outlook
      - `status` (text, not null, default 'sent') - Email status: sent, failed, pending
      - `error_message` (text) - Error details if sending failed
      - `invoice_id` (uuid) - Reference to related invoice (optional)
      - `credit_note_id` (uuid) - Reference to related credit note (optional)
      - `attachment_name` (text) - Name of attached file
      - `sent_at` (timestamptz, default now()) - When the email was sent
      - `created_at` (timestamptz, default now()) - Record creation time

  2. Security
    - Enable RLS on `email_logs` table
    - Add policies for anon access (matching existing app pattern)

  3. Indexes
    - Index on `sent_at` for chronological queries
    - Index on `to_email` for recipient lookups
    - Index on `invoice_id` for invoice-related email lookups
*/

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  to_name text DEFAULT '',
  subject text NOT NULL,
  body text DEFAULT '',
  method text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  credit_note_id uuid REFERENCES credit_notes(id) ON DELETE SET NULL,
  attachment_name text DEFAULT '',
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_method CHECK (method IN ('smtp', 'graph', 'resend', 'outlook')),
  CONSTRAINT valid_status CHECK (status IN ('sent', 'failed', 'pending'))
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to read email logs"
  ON email_logs FOR SELECT
  TO anon
  USING (status IS NOT NULL);

CREATE POLICY "Allow anon to insert email logs"
  ON email_logs FOR INSERT
  TO anon
  WITH CHECK (to_email IS NOT NULL AND subject IS NOT NULL);

CREATE POLICY "Allow anon to update email logs"
  ON email_logs FOR UPDATE
  TO anon
  USING (status IS NOT NULL)
  WITH CHECK (status IS NOT NULL);

CREATE POLICY "Allow anon to delete email logs"
  ON email_logs FOR DELETE
  TO anon
  USING (status IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON email_logs(to_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_invoice_id ON email_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_credit_note_id ON email_logs(credit_note_id);
