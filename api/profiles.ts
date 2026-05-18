import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    const supabaseAdmin = req.supabaseAdmin || createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co',
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'dummy_key_to_prevent_crash'
    );

    if (req.method === 'GET') {
        try {
            // Safe column detection
            const { data: colCheck, error: colError } = await supabaseAdmin.from('profiles').select('*').limit(1);
            let columns = 'id, email, role, status';
            
            const existingCols = (!colError && colCheck && colCheck.length > 0) 
                ? Object.keys(colCheck[0]) 
                : [];

            // Name columns
            if (existingCols.includes('first_name')) columns += ', first_name';
            else if (existingCols.includes('name')) columns += ', name';

            if (existingCols.includes('surname')) columns += ', surname';
            else if (existingCols.includes('last_name')) columns += ', last_name';
            
            // Other columns
            if (existingCols.includes('cell')) columns += ', cell';
            if (existingCols.includes('last_seen_at')) columns += ', last_seen_at';
            if (existingCols.includes('company_id')) columns += ', company_id';
            if (existingCols.includes('avatar_url')) columns += ', avatar_url';

            if (existingCols.length === 0 && !colError) {
                // Table might be empty, try individual checks
                const { error: fErr } = await supabaseAdmin.from('profiles').select('first_name').limit(1);
                if (!fErr) columns += ', first_name';
                const { error: sErr } = await supabaseAdmin.from('profiles').select('surname').limit(1);
                if (!sErr) columns += ', surname';
                else {
                    const { error: lErr } = await supabaseAdmin.from('profiles').select('last_name').limit(1);
                    if (!lErr) columns += ', last_name';
                }
                const { error: cErr } = await supabaseAdmin.from('profiles').select('company_id').limit(1);
                if (!cErr) columns += ', company_id';
                const { error: cellErr } = await supabaseAdmin.from('profiles').select('cell').limit(1);
                if (!cellErr) columns += ', cell';
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
