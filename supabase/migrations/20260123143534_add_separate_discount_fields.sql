/*
  # Aparte kortingsvelden voor verhuur en vergaderruimtes

  1. Wijzigingen
    - Voegt `lease_discount_percentage` toe aan tenants en external_customers
    - Voegt `meeting_discount_percentage` toe aan tenants en external_customers
    - Migreert bestaande `discount_percentage` waarde naar `meeting_discount_percentage`
    - Verwijdert het oude `discount_percentage` veld
  
  2. Reden
    - Maakt het mogelijk om verschillende kortingen toe te passen voor:
      * Reguliere ruimteverhuur (lease_discount_percentage)
      * Vergaderruimte verhuur (meeting_discount_percentage)
    - Geeft meer flexibiliteit in pricing per klant
*/

-- Voeg nieuwe velden toe aan tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS lease_discount_percentage numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS meeting_discount_percentage numeric(5,2) DEFAULT 0;

-- Voeg nieuwe velden toe aan external_customers
ALTER TABLE external_customers 
ADD COLUMN IF NOT EXISTS lease_discount_percentage numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS meeting_discount_percentage numeric(5,2) DEFAULT 0;

-- Migreer bestaande discount_percentage waarden naar meeting_discount_percentage
UPDATE tenants 
SET meeting_discount_percentage = COALESCE(discount_percentage, 0)
WHERE discount_percentage IS NOT NULL;

UPDATE external_customers 
SET meeting_discount_percentage = COALESCE(discount_percentage, 0)
WHERE discount_percentage IS NOT NULL;

-- Verwijder oude discount_percentage kolom
ALTER TABLE tenants DROP COLUMN IF EXISTS discount_percentage;
ALTER TABLE external_customers DROP COLUMN IF EXISTS discount_percentage;
