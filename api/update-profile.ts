import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId, ...dbPayload } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '');

    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(dbPayload)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;
        return res.status(200).json(data);
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
}
