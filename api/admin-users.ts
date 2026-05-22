import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'dummy_key_to_prevent_crash';

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(400).json({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is required to manage users. The ANON key does not have permission.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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
                        ...profileData,
                        created_at: new Date().toISOString()
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
                                status: 'active',
                                created_at: new Date().toISOString()
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
             return res.status(400).json({ error: error.message });
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
