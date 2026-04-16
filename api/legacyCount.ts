import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: Request, res: Response) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
        
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const { count, error } = await supabaseAdmin.from('vehicle_reports').select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error("Supabase count error:", error);
        }

        let legacyCount = 0;
        try {
            const legacyRes = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php');
            const html = await legacyRes.text();
            const countMatch = html.match(/Total Entries:\s*(\d+)/i);
            if (countMatch && countMatch[1]) {
                legacyCount = parseInt(countMatch[1], 10);
            }
        } catch (e) {
            console.error("Legacy fetch failed", e);
        }

        const supabaseTotal = count || 0;
        const sum = supabaseTotal + legacyCount;

        res.status(200).json({ 
            supabaseCount: supabaseTotal, 
            legacyCount, 
            total: sum 
        });
    } catch (error: any) {
        console.error('legacyCount API Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}
