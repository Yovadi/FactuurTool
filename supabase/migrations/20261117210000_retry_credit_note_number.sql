/*
  # Retry credit note numbers the same way as invoice numbers

  Two credit notes created at the same moment could both read the same
  highest number. The function now checks that the number is still free
  and tries again. The credit_note_number column is already unique, so a
  losing insert is rejected and the app asks for a new number.
*/

CREATE OR REPLACE FUNCTION generate_credit_note_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_number integer;
  new_credit_note_number text;
  current_year text;
  attempt integer := 0;
BEGIN
  current_year := TO_CHAR((NOW() AT TIME ZONE 'Europe/Amsterdam')::date, 'YYYY');

  LOOP
    SELECT COALESCE(MAX(CAST(SUBSTRING(cn.credit_note_number FROM 'CN' || current_year || '-(\d+)') AS integer)), 0) + 1
    INTO next_number
    FROM credit_notes cn
    WHERE cn.credit_note_number LIKE 'CN' || current_year || '-%';

    new_credit_note_number := 'CN' || current_year || '-' || LPAD(next_number::text, 4, '0');

    IF NOT EXISTS (SELECT 1 FROM credit_notes WHERE credit_note_number = new_credit_note_number) THEN
      RETURN new_credit_note_number;
    END IF;

    attempt := attempt + 1;
    IF attempt >= 10 THEN
      RAISE EXCEPTION 'Could not generate unique credit note number after % attempts', attempt;
    END IF;

    PERFORM pg_sleep(0.01);
  END LOOP;
END;
$$;

ALTER FUNCTION public.generate_credit_note_number() SET search_path = public;
