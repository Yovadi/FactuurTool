/*
  Payment reminder emails are no longer sent.
  The app turns the old job off when it next sees it. This removes the row.
*/

DELETE FROM scheduled_jobs WHERE job_type = 'send_invoice_reminders';
