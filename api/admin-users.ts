import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';

    if (!supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error: Missing Service Role Key' });
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

            if (authError) throw authError;

            if (authData?.user) {
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        ...profileData,
                        created_at: new Date().toISOString()
                    })
                    .eq('id', authData.user.id);

                if (profileError) {
                    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
                    throw profileError;
                }
            }
            return res.status(200).json({ success: true });
        } catch (error: any) {
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
