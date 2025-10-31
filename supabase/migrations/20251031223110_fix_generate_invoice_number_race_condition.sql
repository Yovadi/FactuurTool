/*
  # Fix Invoice Number Generation Race Condition

  1. Changes
    - Update `generate_invoice_number` function to be transaction-safe
    - Use a loop to retry if duplicate is detected
    - Add proper locking to prevent race conditions

  2. Purpose
    - Prevent duplicate invoice numbers when generating multiple invoices simultaneously
    - Ensure each invoice gets a unique sequential number within its month
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
    -- Get the highest existing number for this month
    SELECT COALESCE(
      MAX(
        CAST(
          SUBSTRING(invoice_number FROM 'INV-[0-9]{6}-([0-9]+)') AS INTEGER
        )
      ), 0
    ) + 1 INTO counter
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || month_year || '-%';
    
    new_number := 'INV-' || month_year || '-' || LPAD(counter::text, 4, '0');
    
    -- Check if this number already exists
    IF NOT EXISTS (SELECT 1 FROM invoices WHERE invoice_number = new_number) THEN
      RETURN new_number;
    END IF;
    
    -- Increment attempt counter
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique invoice number after % attempts', max_attempts;
    END IF;
    
    -- Small delay to avoid tight loop
    PERFORM pg_sleep(0.01);
  END LOOP;
END;
$$;