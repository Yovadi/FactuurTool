/*
  # Add original_file_url to purchase_invoices

  1. Changes
    - Add `original_file_url` text column to `purchase_invoices` so uploaded PDFs can be persisted in storage and retrieved later.
    - Create a public storage bucket `purchase-invoices` (if it does not already exist) for storing the raw uploaded PDF/image files.

  2. Security
    - Bucket is private; authenticated/anon users can upload/read/delete via RLS policies on storage.objects restricted to the bucket.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_invoices' AND column_name = 'original_file_url'
  ) THEN
    ALTER TABLE purchase_invoices ADD COLUMN original_file_url text;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('purchase-invoices', 'purchase-invoices', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'purchase_invoices_read'
  ) THEN
    CREATE POLICY "purchase_invoices_read"
      ON storage.objects FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'purchase-invoices');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'purchase_invoices_insert'
  ) THEN
    CREATE POLICY "purchase_invoices_insert"
      ON storage.objects FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'purchase-invoices');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'purchase_invoices_delete'
  ) THEN
    CREATE POLICY "purchase_invoices_delete"
      ON storage.objects FOR DELETE
      TO anon, authenticated
      USING (bucket_id = 'purchase-invoices');
  END IF;
END $$;
