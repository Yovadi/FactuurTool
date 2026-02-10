/*
  # Integreer Aardlekautomaten met ALA Groepen

  ## Wijzigingen
  1. Voeg `ala_group` toe aan `rcbo_circuit_breakers`
     - Hiermee kunnen RCBOs gekoppeld worden aan specifieke ALAs
  2. Verwijder `rcbo_number` constraint en maak het uniek per ALA groep
     - Een RCBO nummer is nu uniek binnen een ALA groep
  
  ## Beschrijving
  Deze migratie integreert aardlekautomaten in het bestaande ALA systeem.
  Per ALA kan nu gekozen worden tussen:
  - Traditionele aardlek met losse automaten (groepen)
  - Aardlekautomaten (RCBOs) - directe huurder koppeling zonder groepen
  
  ## Beveiliging
  - Bestaande RLS policies blijven van kracht
*/

-- Add ala_group column to rcbo_circuit_breakers
ALTER TABLE rcbo_circuit_breakers 
  ADD COLUMN IF NOT EXISTS ala_group text DEFAULT 'ALA1';

-- Drop old constraint
ALTER TABLE rcbo_circuit_breakers 
  DROP CONSTRAINT IF EXISTS rcbo_circuit_breakers_rcbo_number_check;

-- Add new constraint for rcbo_number range
ALTER TABLE rcbo_circuit_breakers 
  ADD CONSTRAINT rcbo_circuit_breakers_rcbo_number_check 
  CHECK (rcbo_number >= 1 AND rcbo_number <= 50);

-- Create unique index for rcbo_number per ala_group
CREATE UNIQUE INDEX IF NOT EXISTS idx_rcbo_unique_per_ala 
  ON rcbo_circuit_breakers(ala_group, rcbo_number);

-- Create index for ala_group lookups
CREATE INDEX IF NOT EXISTS idx_rcbo_ala_group 
  ON rcbo_circuit_breakers(ala_group);