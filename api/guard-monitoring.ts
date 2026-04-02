import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    // if (req.method !== 'POST') {
    //     return res.status(405).json({ error: 'Method not allowed' });
    // }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { action, ...payload } = body;
    
    const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
    console.log('Supabase URL:', supabaseUrl);
    console.log('Supabase Key:', supabaseServiceKey ? 'Set' : 'Not set');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '');

    let table = '';
    switch (action) {
        case 'add-site': table = 'site'; break;
        case 'add-guard': table = 'guard'; break;
        case 'add-route': table = 'route'; break;
        case 'add-supervisor': table = 'supervisor'; break;
        default: 
            console.log('Invalid action:', action);
            return res.status(400).json({ error: 'Invalid action' });
    }

    console.log('Table:', table);

    try {
        return res.status(200).json({ status: 'ok' });
        // console.log('Inserting into table:', table, 'with payload:', payload);
        // return res.status(200).json({ table, payload });
        // const { data, error } = await supabaseAdmin.from(table).insert(payload).select().single();
        // if (error) {
        //     console.error('Supabase error:', error);
        //     throw error;
        // }
        // return res.status(200).json(data);
    } catch (error: any) {
}
