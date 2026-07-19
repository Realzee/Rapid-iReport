const fs = require('fs');

let content = fs.readFileSync('fix_schema.ts', 'utf-8');

const queryToInsert = `
        "CREATE TABLE IF NOT EXISTS public.tracking_units (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, plate text, imei text NOT NULL UNIQUE, status text DEFAULT 'offline', lat numeric, lng numeric, speed numeric DEFAULT 0, course numeric DEFAULT 0, battery_voltage numeric DEFAULT 0, battery_percent integer DEFAULT 0, acc_status boolean DEFAULT false, fuel_cut boolean DEFAULT false, mileage numeric DEFAULT 0, fuel_level integer DEFAULT 0, speed_limit numeric DEFAULT 100, company_id uuid REFERENCES public.companies(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());",
        "ALTER TABLE public.tracking_units ENABLE ROW LEVEL SECURITY;",
        "DROP POLICY IF EXISTS \\"Users can view tracking units for their company\\" ON public.tracking_units;",
        "CREATE POLICY \\"Users can view tracking units for their company\\" ON public.tracking_units FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));",
        "DROP POLICY IF EXISTS \\"Controllers can manage tracking units for their company\\" ON public.tracking_units;",
        "CREATE POLICY \\"Controllers can manage tracking units for their company\\" ON public.tracking_units FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('controller', 'admin')));",
`;

const insertIndex = content.indexOf('const queries = [') + 'const queries = ['.length;

if (insertIndex > -1) {
    content = content.substring(0, insertIndex) + queryToInsert + content.substring(insertIndex);
    fs.writeFileSync('fix_schema.ts', content);
    console.log("Patched fix_schema.ts successfully");
} else {
    console.log("Could not find queries array in fix_schema.ts");
}
