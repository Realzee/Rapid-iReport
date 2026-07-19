CREATE TABLE IF NOT EXISTS tracking_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plate TEXT,
  imei TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'offline',
  lat NUMERIC,
  lng NUMERIC,
  speed NUMERIC DEFAULT 0,
  course NUMERIC DEFAULT 0,
  battery_voltage NUMERIC DEFAULT 0,
  battery_percent INTEGER DEFAULT 0,
  acc_status BOOLEAN DEFAULT false,
  fuel_cut BOOLEAN DEFAULT false,
  mileage NUMERIC DEFAULT 0,
  fuel_level INTEGER DEFAULT 0,
  speed_limit NUMERIC DEFAULT 100,
  company_id UUID REFERENCES companies(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE tracking_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tracking units for their company"
ON tracking_units FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Controllers can manage tracking units for their company"
ON tracking_units FOR ALL
USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('controller', 'admin'))
);
