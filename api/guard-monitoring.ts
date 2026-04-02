import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '');

    if (req.method === 'GET') {
        const { table } = req.query;
        if (!['site', 'guard', 'route', 'supervisor', 'checkpoint'].includes(table)) {
            return res.status(400).json({ error: 'Invalid table' });
        }
        const { data, error } = await supabaseAdmin.from(table).select('*');
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }

    if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { action, ...payload } = body;
        
        let table = '';
        switch (action) {
            case 'add-site': table = 'site'; break;
            case 'add-guard': table = 'guard'; break;
            case 'add-route': table = 'route'; break;
            case 'add-supervisor': table = 'supervisor'; break;
            case 'add-checkpoint': table = 'checkpoint'; break;
            default: return res.status(400).json({ error: 'Invalid action' });
        }

        try {
            const insertPayload = { ...payload, created_at: new Date().toISOString() };
            const { data, error } = await supabaseAdmin.from(table).insert(insertPayload).select().single();
            if (error) throw error;
            return res.status(200).json(data);
        } catch (error: any) {
            return res.status(400).json({ error: error.message || 'Unknown error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
