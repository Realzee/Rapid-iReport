import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    const SERVICE_ROLE_KEY_VAL = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiYnN2dGxubWpqa29iZnljdWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODI3MTMsImV4cCI6MjEwMDk1ODcxM30.PLeuqc3AKOq5QEFC2nxXIQ3MEEns5hxx7IkBYtzx43s';
    const supabaseUrl = process.env.SUPABASE_URL || 'https://zbbsvtlnmjjkobfycudw.supabase.co';
    
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
             // 1. Set logged_by in gate_access_logs to null to avoid foreign key restrict violations
             try {
                 await supabaseAdmin
                     .from('gate_access_logs')
                     .update({ logged_by: null })
                     .eq('logged_by', id);
             } catch (err) {
                 console.warn("Could not nullify gate_access_logs reference:", err);
             }

             // 2. Delete the auth user (it should cascade to profiles as profiles references auth.users(id) ON DELETE CASCADE)
             const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
             if (authError) {
                 console.error("Auth User Delete Error:", authError);
                 throw authError;
             }

             // 3. Delete profile manually if cascade didn't run
             try {
                 await supabaseAdmin.from('profiles').delete().eq('id', id);
             } catch (err) {
                 // Already deleted via cascade
             }

             return res.status(200).json({ success: true });
         } catch (error: any) {
              console.error("Handler Delete Error:", error);
              return res.status(400).json({ error: error.message || "Database error deleting user" });
         }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
