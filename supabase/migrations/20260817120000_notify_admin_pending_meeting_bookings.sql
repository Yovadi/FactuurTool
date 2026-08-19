/*
  # Notify admins of new meeting-room booking requests

  When a tenant or external customer creates a pending spreekkamer booking
  (typically via the public Netlify booking page), insert an admin_notifications
  row so the activity log records the request. The desktop app also listens to
  meeting_room_bookings inserts in realtime for an immediate popup.
*/

CREATE OR REPLACE FUNCTION notify_admin_of_pending_meeting_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_name text;
  room_name text;
  details text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS NOT NULL THEN
    SELECT COALESCE(company_name, name, 'Huurder')
      INTO customer_name
      FROM tenants
     WHERE id = NEW.tenant_id;
  ELSIF NEW.external_customer_id IS NOT NULL THEN
    SELECT COALESCE(company_name, contact_name, 'Externe klant')
      INTO customer_name
      FROM external_customers
     WHERE id = NEW.external_customer_id;
  END IF;

  customer_name := COALESCE(customer_name, 'Onbekende klant');

  SELECT COALESCE(space_number, 'spreekkamer')
    INTO room_name
    FROM office_spaces
   WHERE id = NEW.space_id;

  room_name := COALESCE(room_name, 'spreekkamer');
  details := room_name || ' op ' || NEW.booking_date::text ||
             ' van ' || left(NEW.start_time::text, 5) ||
             ' tot ' || left(NEW.end_time::text, 5);

  INSERT INTO admin_notifications (
    notification_type,
    title,
    message,
    booking_type,
    booking_id,
    tenant_id,
    external_customer_id,
    is_read
  ) VALUES (
    'booking_pending',
    'Nieuwe Boeking In Afwachting',
    customer_name || ' heeft een nieuwe boeking aangevraagd: ' || details,
    'meeting_room',
    NEW.id,
    NEW.tenant_id,
    NEW.external_customer_id,
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_pending_meeting_booking ON meeting_room_bookings;

CREATE TRIGGER trg_notify_admin_pending_meeting_booking
  AFTER INSERT ON meeting_room_bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_of_pending_meeting_booking();
