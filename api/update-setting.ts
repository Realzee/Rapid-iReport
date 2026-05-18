import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { key, value } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'dummy_key_to_prevent_crash';

    if (!supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error: Missing Service Role Key' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { data, error } = await supabaseAdmin.from('app_settings').upsert({ key, value }).select().single();

        if (error) throw error;
        return res.status(200).json(data);
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
}
