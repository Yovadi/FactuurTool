/*
  # Add VAT Inclusive Setting to Space Type Rates

  1. Changes
    - Add `vat_inclusive` column to `space_type_rates` table
    - Default value is false (prices are exclusive of VAT)
    - This setting controls how invoices are calculated for meeting room bookings

  2. Purpose
    - Allows configuring whether meeting room prices include or exclude VAT
    - Setting can be managed via the Tarieven (Rates) tab
*/

ALTER TABLE space_type_rates
ADD COLUMN IF NOT EXISTS vat_inclusive boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN space_type_rates.vat_inclusive IS 'Whether prices for this space type are VAT inclusive or exclusive';