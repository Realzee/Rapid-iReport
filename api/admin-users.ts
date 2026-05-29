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
        const { email, password, profileData } = req.body;
        try {
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true 
            });

            if (authError) {
                console.error('Auth User Creation Error:', authError);
                throw authError;
            }

            if (authData?.user) {
                // Use upsert to ensure profile exists and is updated
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .upsert({
                        id: authData.user.id,
                        email,
                        ...profileData
                    }, { onConflict: 'id' });

                if (profileError) {
                    console.error('Profile Upsert Error:', profileError);
                    
                    if (profileError.code === '42703') {
                        // Attempt fallback with minimal core fields
                        const { error: fallbackError } = await supabaseAdmin
                            .from('profiles')
                            .upsert({
                                id: authData.user.id,
                                email,
                                role: profileData.role || 'user',
                                status: 'active'
                            }, { onConflict: 'id' });
                        
                        if (!fallbackError) return res.status(200).json({ success: true, user: authData.user, warning: 'Some fields skipped due to schema mismatch' });
                    }
                    
                    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
                    throw profileError;
                }
            }
            return res.status(200).json({ success: true, user: authData.user });
        } catch (error: any) {
             console.error('Admin Create User Exception:', error);
             let msg = error.message;
             if (msg === 'Invalid API key') {
                 msg = 'Invalid API key. Please ensure your SUPABASE_SERVICE_ROLE_KEY is a valid service_role key, not an anon key.';
             }
             return res.status(400).json({ error: msg });
        }
    } else if (req.method === 'DELETE') {
         const { id } = req.body;
         try {
             const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
             if (authError) throw authError;

             const { error: dbError } = await supabaseAdmin.from('profiles').delete().eq('id', id);
             if (dbError) throw dbError;

             return res.status(200).json({ success: true });
         } catch (error: any) {
             return res.status(400).json({ error: error.message });
         }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
