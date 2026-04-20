import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: Request, res: Response) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';

    const action = req.query.action || req.body?.action;

    if (action === 'count' && req.method === 'GET') {
        try {
            const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
            const { count, error } = await supabaseAdmin.from('vehicle_reports').select('*', { count: 'exact', head: true });
            
            if (error) console.error("Supabase count error:", error);

            let legacyCount = 0;
            try {
                const legacyRes = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php');
                const html = await legacyRes.text();
                const countMatch = html.match(/(?:TOTAL RECORDS|Total Entries).*?([\d,]+)/is);
                if (countMatch && countMatch[1]) {
                    legacyCount = parseInt(countMatch[1].replace(/,/g, ''), 10);
                }
            } catch (e) {
                console.error("Legacy fetch failed", e);
            }

            const supabaseTotal = count || 0;
            res.status(200).json({ supabaseCount: supabaseTotal, legacyCount, total: supabaseTotal + legacyCount });
        } catch (error: any) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
        return;
    }

    if (action === 'search' && req.method === 'POST') {
        try {
            const { query } = req.body;
            if (!query) return res.status(400).json({ error: 'Query is required' });

            const formData = new URLSearchParams();
            formData.append('search', query);
            formData.append('submit-search', '');

            const legacyRes = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString()
            });

            if (!legacyRes.ok) throw new Error(`Legacy system responded with status: ${legacyRes.status}`);

            const html = await legacyRes.text();
            const results = [];
            
            const regex = /data-entry='(\{[\s\S]*?\})'/g;
            let match;

            while ((match = regex.exec(html)) !== null) {
                try {
                    // Fix potential HTML encoded issues just in case
                    const rawJsonStr = match[1].replace(/&quot;/g, '"');
                    const row = JSON.parse(rawJsonStr);
                    // Only add if we haven't seen this ID yet to prevent duplicates if data-entry appears on both View and Edit buttons
                    if (!results.find(r => r.id === `legacy-${row.id}`)) {
                            const recoveredVal = String(row.recovered || '').trim().toLowerCase();
                            const isRecovered = ['yes', 'recovered', 'true', 'y', '1'].includes(recoveredVal);
                            
                            results.push({
                                id: `legacy-${row.id}`,
                                license_plate: row.vehicle_registration || '',
                                vehicle_make: row.make || '',
                                vehicle_model: row.model || '',
                                vehicle_color: row.color || '',
                                description: row.reason || '',
                                cos_name: row.cos_name || '',
                                cos_contact_number: row.cos_contact_number || '',
                                cas_number: row.case_number || '',
                                station_name: row.station_reported_at || '',
                                io_name: row.io_name || '',
                                io_contact: row.io_contact || '',
                                status: isRecovered ? 'recovered' : 'stolen',
                                has_tracker: String(row.tracker).toLowerCase() === 'yes',
                                reported_at: (() => {
                                    if (!row.date_of_incident) return new Date().toISOString();
                                    const d = new Date(row.date_of_incident);
                                    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
                                })(),
                                reported_by: 'system',
                                is_legacy: true,
                                type: 'vehicle'
                            });
                    }
                } catch (e) {
                    console.error("Failed to parse row JSON", e);
                }
            }

            res.status(200).json(results);
        } catch (error: any) {
            res.status(500).json({ error: 'Internal Server Error', message: error.message });
        }
        return;
    }

    if (action === 'add' && req.method === 'POST') {
        try {
            const data = req.body;
            const formData = new URLSearchParams();
            
            formData.append('add-vehicle_registration', data.vehicle_registration || '');
            formData.append('add-make', data.make || '');
            formData.append('add-model', data.model || '');
            formData.append('add-color', data.color || '');
            formData.append('add-reason', data.reason || '');
            formData.append('add-cos_name', data.cos_name || '');
            formData.append('add-cos_contact_number', data.cos_contact_number || '');
            formData.append('add-case_number', data.case_number || '');
            formData.append('add-station_reported_at', data.station_reported_at || '');
            formData.append('add-io_name', data.io_name || '');
            formData.append('add-io_contact', data.io_contact || '');
            formData.append('add-recovered', data.recovered || '');
            formData.append('add-tracker', data.tracker || '');
            formData.append('add-date_of_incident', data.date_of_incident || '');
            formData.append('submit-add', '');

            const legacyRes = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString()
            });

            if (!legacyRes.ok) throw new Error(`Legacy system status: ${legacyRes.status}`);

            res.status(200).json({ success: true, message: 'Added successfully to legacy database' });
        } catch (error: any) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
        return;
    }

    return res.status(404).json({ error: 'Action not found' });
}
