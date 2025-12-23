/*
  # Voeg gemeubileerd tarief toe voor flexplekken

  1. Changes
    - Voeg daily_rate_furnished kolom toe aan space_type_rates
    - Dit maakt het mogelijk om verschillende tarieven te hebben voor gemeubileerde flexplekken
    - Standaard €35,00 per dag voor gemeubileerde flexplek (vs €25,00 basis)

  2. Notes
    - Flexplekken werken nu hetzelfde als kantoren: basis tarief en gemeubileerd tarief
*/

-- Add furnished daily rate column
ALTER TABLE space_type_rates 
ADD COLUMN IF NOT EXISTS daily_rate_furnished DECIMAL(10,2) DEFAULT 0.00;

-- Set the furnished rate for Flexplek
UPDATE space_type_rates 
SET 
  daily_rate_furnished = 35.00,
  description_furnished = 'Flexplek gemeubileerd - prijs per dag'
WHERE space_type = 'Flexplek';