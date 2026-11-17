/*
  Deelbetalingen en een harde grens op credit.

  Plak dit script in de Supabase SQL-editor. De app past dit niet zelf toe.

  - invoices.paid_amount: som van geregistreerde betalingen
  - invoice_payments: bedrag, datum en notitie per betaling
  - een betaling die het restant dekt zet de factuur op betaald
  - credit mag het openstaande factuurbedrag en het creditnotabedrag niet overschrijden
*/

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  paid_on date NOT NULL DEFAULT ((NOW() AT TIME ZONE 'Europe/Amsterdam')::date),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view invoice payments" ON invoice_payments;
DROP POLICY IF EXISTS "Anyone can insert invoice payments" ON invoice_payments;
DROP POLICY IF EXISTS "Anyone can update invoice payments" ON invoice_payments;
DROP POLICY IF EXISTS "Anyone can delete invoice payments" ON invoice_payments;

CREATE POLICY "Anyone can view invoice payments"
  ON invoice_payments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert invoice payments"
  ON invoice_payments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update invoice payments"
  ON invoice_payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete invoice payments"
  ON invoice_payments FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION update_invoice_paid_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_paid numeric;
  v_credit numeric;
  v_amount numeric;
  v_status text;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_invoice_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM invoice_payments
  WHERE invoice_id = v_invoice_id;

  SELECT amount, COALESCE(applied_credit, 0), status
    INTO v_amount, v_credit, v_status
  FROM invoices
  WHERE id = v_invoice_id;

  UPDATE invoices
  SET paid_amount = v_paid
  WHERE id = v_invoice_id;

  IF v_status IN ('sent', 'overdue') AND v_paid + v_credit >= v_amount - 0.009 THEN
    IF v_credit >= v_amount - 0.009 AND v_paid <= 0.009 THEN
      UPDATE invoices SET status = 'credited' WHERE id = v_invoice_id;
    ELSE
      UPDATE invoices
      SET status = 'paid', paid_at = COALESCE(paid_at, now())
      WHERE id = v_invoice_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_invoice_paid_amount ON invoice_payments;
CREATE TRIGGER trigger_update_invoice_paid_amount
  AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_paid_amount();

CREATE OR REPLACE FUNCTION reject_excess_credit_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_invoice_amount numeric;
  v_paid numeric;
  v_already numeric;
  v_credit_total numeric;
  v_credit_used numeric;
BEGIN
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT amount, COALESCE(paid_amount, 0)
      INTO v_invoice_amount, v_paid
    FROM invoices
    WHERE id = NEW.invoice_id;

    SELECT COALESCE(SUM(applied_amount), 0) INTO v_already
    FROM credit_note_applications
    WHERE invoice_id = NEW.invoice_id
      AND id IS DISTINCT FROM NEW.id;

    IF v_invoice_amount IS NOT NULL
       AND v_already + NEW.applied_amount > v_invoice_amount - v_paid + 0.009 THEN
      RAISE EXCEPTION 'Credit overschrijdt het openstaande factuurbedrag';
    END IF;
  END IF;

  IF NEW.credit_note_id IS NOT NULL THEN
    SELECT total_amount INTO v_credit_total
    FROM credit_notes
    WHERE id = NEW.credit_note_id;

    SELECT COALESCE(SUM(applied_amount), 0) INTO v_credit_used
    FROM credit_note_applications
    WHERE credit_note_id = NEW.credit_note_id
      AND id IS DISTINCT FROM NEW.id;

    IF v_credit_total IS NOT NULL
       AND v_credit_used + NEW.applied_amount > v_credit_total + 0.009 THEN
      RAISE EXCEPTION 'Credit overschrijdt het bedrag van de creditnota';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_reject_excess_credit_application ON credit_note_applications;
CREATE TRIGGER trigger_reject_excess_credit_application
  BEFORE INSERT OR UPDATE ON credit_note_applications
  FOR EACH ROW
  EXECUTE FUNCTION reject_excess_credit_application();

CREATE OR REPLACE FUNCTION update_invoice_applied_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_total_applied numeric;
  v_invoice_amount numeric;
  v_paid numeric;
  v_current_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;

  IF v_invoice_id IS NOT NULL THEN
    SELECT COALESCE(SUM(applied_amount), 0) INTO v_total_applied
    FROM credit_note_applications
    WHERE invoice_id = v_invoice_id;

    SELECT amount, COALESCE(paid_amount, 0), status
      INTO v_invoice_amount, v_paid, v_current_status
    FROM invoices
    WHERE id = v_invoice_id;

    UPDATE invoices
    SET applied_credit = v_total_applied
    WHERE id = v_invoice_id;

    IF v_total_applied + v_paid >= v_invoice_amount - 0.009
       AND v_current_status NOT IN ('credited', 'cancelled', 'paid') THEN
      IF v_total_applied >= v_invoice_amount - 0.009 AND v_paid <= 0.009 THEN
        UPDATE invoices SET status = 'credited' WHERE id = v_invoice_id;
      ELSE
        UPDATE invoices
        SET status = 'paid', paid_at = COALESCE(paid_at, now())
        WHERE id = v_invoice_id;
      END IF;
    ELSIF v_total_applied + v_paid < v_invoice_amount - 0.009
          AND v_current_status = 'credited' THEN
      UPDATE invoices SET status = 'sent' WHERE id = v_invoice_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
