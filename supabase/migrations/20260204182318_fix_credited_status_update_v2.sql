/*
  # Fix Credited Status Update

  1. Changes
    - Improve the trigger logic to update status within the same transaction
    - Update existing invoices with applied_credit >= amount to 'credited' status
    - Ensure the status update happens after applied_credit is calculated

  2. Security
    - No changes to RLS policies needed
*/

-- First, update existing invoices that should be credited
UPDATE invoices
SET status = 'credited'
WHERE applied_credit >= amount 
  AND status NOT IN ('credited', 'cancelled');

-- Drop the old trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_invoice_status_on_credit ON credit_note_applications;
DROP FUNCTION IF EXISTS update_invoice_status_on_credit();

-- Update the invoice applied credit function to also handle status
CREATE OR REPLACE FUNCTION update_invoice_applied_credit()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id uuid;
  v_total_applied numeric;
  v_invoice_amount numeric;
  v_current_status text;
BEGIN
  -- Determine which invoice_id to work with
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;

  -- Only proceed if we have an invoice_id
  IF v_invoice_id IS NOT NULL THEN
    -- Calculate total applied credit
    SELECT COALESCE(SUM(applied_amount), 0) INTO v_total_applied
    FROM credit_note_applications
    WHERE invoice_id = v_invoice_id;

    -- Get invoice details
    SELECT amount, status INTO v_invoice_amount, v_current_status
    FROM invoices
    WHERE id = v_invoice_id;

    -- Update applied_credit
    UPDATE invoices
    SET applied_credit = v_total_applied
    WHERE id = v_invoice_id;

    -- Update status based on applied credit
    IF v_total_applied >= v_invoice_amount AND v_current_status NOT IN ('credited', 'cancelled') THEN
      UPDATE invoices
      SET status = 'credited'
      WHERE id = v_invoice_id;
    ELSIF v_total_applied < v_invoice_amount AND v_current_status = 'credited' THEN
      -- If credit was removed and status was credited, revert to sent
      UPDATE invoices
      SET status = 'sent'
      WHERE id = v_invoice_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_invoice_applied_credit ON credit_note_applications;
CREATE TRIGGER trigger_update_invoice_applied_credit
  AFTER INSERT OR UPDATE OR DELETE ON credit_note_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_applied_credit();