/*
  # Fix generate_credit_note_number Function

  1. Changes
    - Fix ambiguous column reference in generate_credit_note_number function
    - Use table alias to clarify which credit_note_number is being referenced
  
  2. Details
    - The function had a conflict between the local variable 'credit_note_number' 
      and the table column 'credit_note_number'
    - Adding table alias 'cn' resolves the ambiguity
*/

-- Drop and recreate the function with proper table aliasing
DROP FUNCTION IF EXISTS generate_credit_note_number();

CREATE OR REPLACE FUNCTION generate_credit_note_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_number integer;
  new_credit_note_number text;
  current_year text;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(cn.credit_note_number FROM 'CN' || current_year || '-(\d+)') AS integer)), 0) + 1
  INTO next_number
  FROM credit_notes cn
  WHERE cn.credit_note_number LIKE 'CN' || current_year || '-%';
  
  new_credit_note_number := 'CN' || current_year || '-' || LPAD(next_number::text, 4, '0');
  
  RETURN new_credit_note_number;
END;
$$;
