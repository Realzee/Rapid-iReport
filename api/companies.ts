import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    const SERVICE_ROLE_KEY_VAL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
    const supabaseUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    
    let supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseServiceKey || supabaseServiceKey.length < 50 || supabaseServiceKey.includes('dummy') || supabaseServiceKey === 'undefined' || supabaseServiceKey === 'null') {
        supabaseServiceKey = SERVICE_ROLE_KEY_VAL;
    }

    const supabaseAdmin = req.supabaseAdmin || createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'POST') {
        const { key, value } = req.body;
        if (key && value !== undefined) {
            try {
                const { data, error } = await supabaseAdmin.from('app_settings').upsert({ key, value }).select().single();
                if (error) throw error;
                return res.status(200).json(data);
            } catch (error: any) {
                console.error('Error updating setting in companies handler:', error);
                let msg = error.message || 'Failed to update setting';
                if (msg === 'Invalid API key') {
                    msg = 'Invalid API key. Please ensure your SUPABASE_SERVICE_ROLE_KEY is a valid service_role key.';
                }
                return res.status(400).json({ error: msg });
            }
        }

        // Save company
        const { id, ...dbPayload } = req.body;
        try {
            let data, error;
            if (id) {
                ({ data, error } = await supabaseAdmin.from('companies').update(dbPayload).eq('id', id).select().single());
            } else {
                ({ data, error } = await supabaseAdmin.from('companies').insert(dbPayload).select().single());
            }

            if (error) {
                return res.status(400).json({ error: error.message });
            }
            return res.status(200).json(data);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    } else if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'Missing ID' });
        try {
            // First map all users of this company to unassigned
            const { error: usersError } = await supabaseAdmin
                .from('profiles')
                .update({ company_id: null })
                .eq('company_id', id);
            
            if (usersError) throw usersError;

            // Then delete the company
            const { error: deleteError } = await supabaseAdmin.from('companies').delete().eq('id', id);
            if (deleteError) throw deleteError;
            
            return res.status(200).json({ success: true });
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
