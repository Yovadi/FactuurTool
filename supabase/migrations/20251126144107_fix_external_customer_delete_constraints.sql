/*
  # Fix External Customer Delete Constraints

  1. Changes
    - Update foreign key constraints to use CASCADE instead of SET NULL
    - This ensures that when an external customer is deleted, their related records are also deleted
    - Applies to: invoices, credit_notes, and meeting_room_bookings

  2. Security
    - Maintains existing RLS policies
    - No changes to access control

  3. Notes
    - This fixes the conflict between ON DELETE SET NULL and check constraints
    - Ensures data consistency when deleting external customers
*/

-- Drop and recreate foreign key for meeting_room_bookings.external_customer_id
DO $$
BEGIN
  -- Drop the existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'meeting_room_bookings_external_customer_id_fkey'
    AND table_name = 'meeting_room_bookings'
  ) THEN
    ALTER TABLE meeting_room_bookings
    DROP CONSTRAINT meeting_room_bookings_external_customer_id_fkey;
  END IF;

  -- Add the new constraint with ON DELETE CASCADE
  ALTER TABLE meeting_room_bookings
  ADD CONSTRAINT meeting_room_bookings_external_customer_id_fkey
  FOREIGN KEY (external_customer_id)
  REFERENCES external_customers(id)
  ON DELETE CASCADE;
END $$;

-- Drop and recreate foreign key for invoices.external_customer_id
DO $$
BEGIN
  -- Drop the existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_external_customer_id_fkey'
    AND table_name = 'invoices'
  ) THEN
    ALTER TABLE invoices
    DROP CONSTRAINT invoices_external_customer_id_fkey;
  END IF;

  -- Add the new constraint with ON DELETE CASCADE
  ALTER TABLE invoices
  ADD CONSTRAINT invoices_external_customer_id_fkey
  FOREIGN KEY (external_customer_id)
  REFERENCES external_customers(id)
  ON DELETE CASCADE;
END $$;

-- Drop and recreate foreign key for credit_notes.external_customer_id
DO $$
BEGIN
  -- Drop the existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'credit_notes_external_customer_id_fkey'
    AND table_name = 'credit_notes'
  ) THEN
    ALTER TABLE credit_notes
    DROP CONSTRAINT credit_notes_external_customer_id_fkey;
  END IF;

  -- Add the new constraint with ON DELETE CASCADE
  ALTER TABLE credit_notes
  ADD CONSTRAINT credit_notes_external_customer_id_fkey
  FOREIGN KEY (external_customer_id)
  REFERENCES external_customers(id)
  ON DELETE CASCADE;
END $$;
