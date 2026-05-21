import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabaseAdmin = createClient(url, serviceKey);

async function test() {
    console.log("Checking profiles table in DB...");
    const { data: profiles, error: pError } = await supabaseAdmin.from('profiles').select('*').limit(3);
    if (pError) {
        console.error("Error getting profiles:", pError);
        return;
    }
    console.log(`Found ${profiles?.length || 0} profiles.`);
    if (profiles && profiles.length > 0) {
        const testUser = profiles[0];
        console.log("Testing API endpoint /api/update-profile update via fetch...");
        
        // Let's call the local API directly via nodes or manually invoke the handler
        import('./api/update-profile').then(async (m) => {
            const handler = m.default;
            const req = {
                method: 'POST',
                body: {
                    userId: testUser.id,
                    last_seen_at: new Date().toISOString()
                }
            };
            const res = {
                status: (code: number) => {
                    console.log("API Status:", code);
                    return {
                        json: (data: any) => {
                            console.log("API JSON response:", data);
                        }
                    };
                }
            };
            try {
                await handler(req, res);
            } catch (err) {
                console.error("Handler error:", err);
            }
        });
    }
}

test();
