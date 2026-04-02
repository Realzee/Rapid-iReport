import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, ...payload } = req.body;
    
    const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '');

    let table = '';
    switch (action) {
        case 'add-site': table = 'sites'; break;
        case 'add-guard': table = 'guards'; break;
        case 'add-route': table = 'routes'; break;
        case 'add-supervisor': table = 'supervisors'; break;
        default: return res.status(400).json({ error: 'Invalid action' });
    }

    try {
        const { data, error } = await supabaseAdmin.from(table).insert(payload).select().single();
        if (error) throw error;
        return res.status(200).json(data);
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
}
