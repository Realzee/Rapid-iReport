import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const SERVICE_ROLE_KEY_VAL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    
    let supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseServiceKey || supabaseServiceKey.length < 50 || supabaseServiceKey.includes('dummy') || supabaseServiceKey === 'undefined' || supabaseServiceKey === 'null') {
        supabaseServiceKey = SERVICE_ROLE_KEY_VAL;
    }

    const supabaseAdmin = req.supabaseAdmin || createClient(supabaseUrl, supabaseServiceKey);

    const { userId, user_id, action, details, ip_address } = req.body || {};
    const finalUserId = userId || user_id;

    if (!action) {
        return res.status(400).json({ error: 'Action is required' });
    }

    try {
        // Validate uuid if provided, otherwise leave null or valid format
        const isValidUuid = finalUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalUserId);

        const insertPayload: any = {
            action: String(action).substring(0, 100),
            details: details ? String(details).substring(0, 2000) : null,
            ip_address: ip_address || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
            created_at: new Date().toISOString()
        };

        if (isValidUuid) {
            insertPayload.user_id = finalUserId;
        }

        const { data, error } = await supabaseAdmin
            .from('user_activity_logs')
            .insert(insertPayload)
            .select()
            .single();

        if (error) {
            console.warn('[log-activity API] Insertion warning:', error.message);
            return res.status(200).json({ success: false, warning: error.message });
        }

        return res.status(200).json({ success: true, log: data });
    } catch (err: any) {
        console.warn('[log-activity API] Exception handled gracefully:', err?.message || err);
        return res.status(200).json({ success: false, error: err?.message || 'Handled exception' });
    }
}
