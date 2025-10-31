/*
  # Fix Invoice Number Sequence to be Global

  1. Changes
    - Update `generate_invoice_number` function to generate sequential numbers
    - Number should continue from the highest existing number in the database
    - Should work across all invoice statuses (draft, sent, paid, etc.)

  2. Purpose
    - Ensure invoice numbers are truly sequential
    - Don't skip numbers based on status
    - Make it easy to track all invoices in order
*/

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_number text;
  counter integer;
  month_year text;
  max_attempts integer := 10;
  attempt integer := 0;
BEGIN
  month_year := TO_CHAR(CURRENT_DATE, 'YYYYMM');
  
  LOOP
    -- Get the highest existing number for this month across ALL invoices
    SELECT COALESCE(
      MAX(
        CAST(
          SUBSTRING(invoice_number FROM 'INV-' || month_year || '-([0-9]+)') AS INTEGER
        )
      ), 0
    ) + 1 INTO counter
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || month_year || '-%';
    
    new_number := 'INV-' || month_year || '-' || LPAD(counter::text, 4, '0');
    
    -- Double-check this number doesn't exist (race condition protection)
    IF NOT EXISTS (SELECT 1 FROM invoices WHERE invoice_number = new_number) THEN
      RETURN new_number;
    END IF;
    
    -- If we get here, there was a race condition, retry
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique invoice number after % attempts', max_attempts;
    END IF;
    
    -- Small delay to reduce chance of collision
    PERFORM pg_sleep(0.01);
  END LOOP;
END;
$$;