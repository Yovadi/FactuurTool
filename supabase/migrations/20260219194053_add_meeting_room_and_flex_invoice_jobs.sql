/*
  # Add Meeting Room and Flex Invoice Scheduled Jobs

  ## Summary
  Adds two new automated billing jobs to the scheduled_jobs table:

  1. `generate_meeting_room_invoices`
     - Automatically generates invoices for all confirmed/completed meeting room bookings
       that have not yet been invoiced, grouped by customer per calendar month.
     - Runs monthly on the 1st of each month.

  2. `generate_flex_invoices`
     - Automatically generates invoices for all confirmed/completed flex workspace day
       bookings that have not yet been invoiced, grouped by customer per calendar month.
     - Runs monthly on the 1st of each month.

  ## Changes
  - Inserts two new rows into `scheduled_jobs` if they do not already exist.
  - Both jobs are disabled by default and must be explicitly enabled by the user.
  - `next_run_at` is set to the 1st of next month at 00:00 UTC.
*/

DO $$
DECLARE
  next_month_first TIMESTAMP WITH TIME ZONE;
BEGIN
  next_month_first := date_trunc('month', now()) + interval '1 month';

  INSERT INTO scheduled_jobs (job_type, is_enabled, next_run_at)
  SELECT 'generate_meeting_room_invoices', false, next_month_first
  WHERE NOT EXISTS (
    SELECT 1 FROM scheduled_jobs WHERE job_type = 'generate_meeting_room_invoices'
  );

  INSERT INTO scheduled_jobs (job_type, is_enabled, next_run_at)
  SELECT 'generate_flex_invoices', false, next_month_first
  WHERE NOT EXISTS (
    SELECT 1 FROM scheduled_jobs WHERE job_type = 'generate_flex_invoices'
  );
END $$;
