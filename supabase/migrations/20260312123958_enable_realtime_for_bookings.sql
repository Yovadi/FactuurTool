/*
  # Enable Realtime for Booking Tables

  1. Changes
    - Enable REPLICA IDENTITY FULL for meeting_room_bookings table
    - Enable REPLICA IDENTITY FULL for flex_day_bookings table
    - Add tables to supabase_realtime publication

  2. Purpose
    - Allows the dashboard to receive realtime updates when bookings are created, modified, or deleted
    - Ensures pending bookings appear/disappear immediately without manual refresh
*/

ALTER TABLE meeting_room_bookings REPLICA IDENTITY FULL;
ALTER TABLE flex_day_bookings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'meeting_room_bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE meeting_room_bookings;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'flex_day_bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE flex_day_bookings;
  END IF;
END $$;