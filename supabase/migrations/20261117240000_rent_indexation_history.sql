/*
  Geschiedenis van doorgevoerde huurverhogingen.

  Plak dit script in de Supabase SQL-editor. De app past dit niet zelf toe.
  Zonder deze tabel gaat een verhoging wel door, maar blijft de lijst leeg.
*/

CREATE TABLE IF NOT EXISTS rent_indexation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid REFERENCES leases(id) ON DELETE SET NULL,
  tenant_name text NOT NULL,
  percentage numeric NOT NULL,
  old_monthly_rent numeric NOT NULL,
  new_monthly_rent numeric NOT NULL,
  applied_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rent_indexation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view rent indexation history" ON rent_indexation_history;
DROP POLICY IF EXISTS "Anyone can insert rent indexation history" ON rent_indexation_history;

CREATE POLICY "Anyone can view rent indexation history"
  ON rent_indexation_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert rent indexation history"
  ON rent_indexation_history FOR INSERT TO anon, authenticated WITH CHECK (true);
