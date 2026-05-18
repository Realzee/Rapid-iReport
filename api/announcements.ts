import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'dummy_key_to_prevent_crash';

    if (!supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error: Missing Service Role Key' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'POST') {
        // Save (create or update) announcement
        const { id, ...dbPayload } = req.body;
        try {
            let data, error;
            if (id) {
                ({ data, error } = await supabaseAdmin.from('announcements').update(dbPayload).eq('id', id).select().single());
            } else {
                ({ data, error } = await supabaseAdmin.from('announcements').insert(dbPayload).select().single());
            }

            if (error) throw error;
            return res.status(200).json(data);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    } else if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'Missing ID' });
        try {
            const { error } = await supabaseAdmin.from('announcements').delete().eq('id', id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
