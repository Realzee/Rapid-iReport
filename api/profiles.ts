import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '');

    if (req.method === 'GET') {
        try {
            // Safe column detection
            const { data: colCheck, error: colError } = await supabaseAdmin.from('profiles').select('*').limit(1);
            let columns = 'id, email, first_name, last_name, role';
            
            if (!colError && colCheck && colCheck.length > 0) {
                const existingCols = Object.keys(colCheck[0]);
                if (existingCols.includes('company_id')) {
                    columns += ', company_id';
                }
            } else if (!colError && colCheck && colCheck.length === 0) {
                // Table is empty, try to select with company_id to see if it even exists
                const { error: testError } = await supabaseAdmin.from('profiles').select('company_id').limit(1);
                if (!testError) {
                    columns += ', company_id';
                }
            }
            
            const { data, error } = await supabaseAdmin
                .from('profiles')
                .select(columns)
                .order('email');
                
            if (error) {
                console.error('Error fetching profiles:', error);
                return res.status(500).json({ error: error.message, code: error.code });
            }
            return res.status(200).json(data);
        } catch (e: any) {
            console.error('Profiles handler crash:', e);
            return res.status(500).json({ error: e.message || 'Unknown internal error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
