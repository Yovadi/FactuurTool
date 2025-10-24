/*
  # Fix Monthly Rent Calculation

  1. Changes
    - Updates all existing `lease_spaces.monthly_rent` values to divide by 12
    - This ensures consistency between stored values and display calculations
    
  2. Notes
    - Previously, monthly_rent was stored as yearly rent (square_footage × price_per_sqm)
    - Now, monthly_rent correctly stores monthly rent (square_footage × price_per_sqm / 12)
*/

-- Update existing lease_spaces to have correct monthly rent
UPDATE lease_spaces
SET monthly_rent = monthly_rent / 12
WHERE monthly_rent > 0;