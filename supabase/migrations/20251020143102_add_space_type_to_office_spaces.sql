/*
  # Add space_type to office_spaces

  1. Changes
    - Add `space_type` column to `office_spaces` table
    - Set default value to 'kantoor' (office)
    - Allow values: 'kantoor' (office) or 'hal' (hall)
  
  2. Notes
    - Existing spaces will default to 'kantoor'
    - This enables distinguishing between office spaces and hall spaces
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spaces' AND column_name = 'space_type'
  ) THEN
    ALTER TABLE office_spaces 
    ADD COLUMN space_type text DEFAULT 'kantoor' NOT NULL
    CHECK (space_type IN ('kantoor', 'hal'));
  END IF;
END $$;