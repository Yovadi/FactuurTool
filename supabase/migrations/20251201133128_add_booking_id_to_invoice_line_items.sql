/*
  # Add booking reference to invoice line items

  1. Changes
    - Add `booking_id` column to `invoice_line_items` table to link line items to specific bookings
    - This allows showing detailed booking information (date, hours) on invoices
    - Nullable to support both booking-based and manual line items

  2. Notes
    - Existing line items will have NULL booking_id (manual entries)
    - New booking-based line items will reference the booking
    - No data loss, fully backward compatible
*/

-- Add booking_id column to invoice_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_line_items' AND column_name = 'booking_id'
  ) THEN
    ALTER TABLE invoice_line_items
    ADD COLUMN booking_id uuid REFERENCES meeting_room_bookings(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_invoice_line_items_booking_id
    ON invoice_line_items(booking_id);
  END IF;
END $$;
