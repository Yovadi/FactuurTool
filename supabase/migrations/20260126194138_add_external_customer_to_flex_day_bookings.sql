/*
  # Voeg externe klant ondersteuning toe aan flex day bookings

  1. Wijzigingen
    - Maak lease_id nullable in flex_day_bookings (was verplicht)
    - Voeg external_customer_id toe als optioneel veld
    - Voeg constraint toe dat óf lease_id óf external_customer_id ingevuld moet zijn
    - Voeg foreign key constraint toe voor external_customer_id
  
  2. Veiligheid
    - Bestaande data blijft intact (alle bestaande records hebben lease_id)
    - RLS policies blijven ongewijzigd
*/

-- Maak lease_id nullable
ALTER TABLE flex_day_bookings 
  ALTER COLUMN lease_id DROP NOT NULL;

-- Voeg external_customer_id toe
ALTER TABLE flex_day_bookings 
  ADD COLUMN IF NOT EXISTS external_customer_id uuid REFERENCES external_customers(id) ON DELETE CASCADE;

-- Voeg constraint toe dat minimaal één van beide ingevuld moet zijn
ALTER TABLE flex_day_bookings
  DROP CONSTRAINT IF EXISTS flex_day_bookings_customer_check;

ALTER TABLE flex_day_bookings
  ADD CONSTRAINT flex_day_bookings_customer_check 
  CHECK (
    (lease_id IS NOT NULL AND external_customer_id IS NULL) OR
    (lease_id IS NULL AND external_customer_id IS NOT NULL)
  );

-- Voeg index toe voor betere performance
CREATE INDEX IF NOT EXISTS idx_flex_day_bookings_external_customer 
  ON flex_day_bookings(external_customer_id);
