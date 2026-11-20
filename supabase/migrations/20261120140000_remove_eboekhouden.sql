/*
  Remove the unused e-Boekhouden integration.

  Drops the sync tables, the stored API token, and the ledger columns that
  existed only for that coupling. Safe to run more than once.
  Does not touch paid_at, e-mail settings, or invoice amounts.
*/

DELETE FROM scheduled_jobs
WHERE job_type IN (
  'eboekhouden_payment_status_check',
  'eboekhouden_sync_verification',
  'eboekhouden_relation_verification'
);

DROP TABLE IF EXISTS eboekhouden_sync_log;
DROP TABLE IF EXISTS eboekhouden_grootboek_mapping;

ALTER TABLE company_settings
  DROP COLUMN IF EXISTS eboekhouden_api_token,
  DROP COLUMN IF EXISTS eboekhouden_connected,
  DROP COLUMN IF EXISTS eboekhouden_enabled,
  DROP COLUMN IF EXISTS eboekhouden_template_id;

ALTER TABLE tenants DROP COLUMN IF EXISTS eboekhouden_relatie_id;
ALTER TABLE external_customers DROP COLUMN IF EXISTS eboekhouden_relatie_id;

ALTER TABLE invoices
  DROP COLUMN IF EXISTS eboekhouden_factuur_id,
  DROP COLUMN IF EXISTS eboekhouden_synced_at,
  DROP COLUMN IF EXISTS eboekhouden_not_found;

ALTER TABLE credit_notes
  DROP COLUMN IF EXISTS eboekhouden_id,
  DROP COLUMN IF EXISTS eboekhouden_synced_at,
  DROP COLUMN IF EXISTS eboekhouden_not_found;

ALTER TABLE purchase_invoices
  DROP COLUMN IF EXISTS eboekhouden_factuur_id,
  DROP COLUMN IF EXISTS eboekhouden_synced_at,
  DROP COLUMN IF EXISTS eboekhouden_relatie_id,
  DROP COLUMN IF EXISTS eboekhouden_not_found;

ALTER TABLE invoice_line_items
  DROP COLUMN IF EXISTS grootboek_id,
  DROP COLUMN IF EXISTS local_category;

ALTER TABLE purchase_invoice_line_items DROP COLUMN IF EXISTS grootboek_id;
ALTER TABLE credit_note_line_items DROP COLUMN IF EXISTS grootboek_id;
