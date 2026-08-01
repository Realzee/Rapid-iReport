import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    

    const { userId, password } = req.body;
    const SERVICE_ROLE_KEY_VAL = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiYnN2dGxubWpqa29iZnljdWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODI3MTMsImV4cCI6MjEwMDk1ODcxM30.PLeuqc3AKOq5QEFC2nxXIQ3MEEns5hxx7IkBYtzx43s';
    const supabaseUrl = process.env.SUPABASE_URL || 'https://zbbsvtlnmjjkobfycudw.supabase.co';
    
    let supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseServiceKey || supabaseServiceKey.length < 50 || supabaseServiceKey.includes('dummy') || supabaseServiceKey === 'undefined' || supabaseServiceKey === 'null') {
        supabaseServiceKey = SERVICE_ROLE_KEY_VAL;
    }

    const supabaseAdmin = req.supabaseAdmin || createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password
        });

        if (error) throw error;
        return res.status(200).json(data);
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
}
