import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    const supabaseAdmin = req.supabaseAdmin || createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co',
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'dummy_key_to_prevent_crash'
    );

    const action = req.query.action || req.body?.action;

    const hasServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if (!hasServiceKey && !req.supabaseAdmin) {
        if (req.method === 'GET') return res.status(200).json(action === 'count' ? { total: 0 } : []);
        return res.status(200).json({ success: true, dummy: true });
    }

    if (action === 'debug-tables' && req.method === 'GET') {
        try {
            const { data, error } = await supabaseAdmin.rpc('eval', {
                query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
            });
            return res.status(200).json({ data, error });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    if (action === 'count' && req.method === 'GET') {
        try {
            const { count, error } = await supabaseAdmin.from('vehicle_reports').select('*', { count: 'exact', head: true });
            
            if (error) console.error("Supabase count error:", error);

            let legacyCount = 0;
            try {
                const legacyRes = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php', {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });
                const html = await legacyRes.text();
                
                if (legacyRes.status === 403) {
                    console.warn("Legacy system returned 403 Forbidden. Body snippet:", html.substring(0, 200));
                }
                
                const countMatch = html.match(/(?:TOTAL RECORDS|Total Entries).*?([\d,]+)/is);
                if (countMatch && countMatch[1]) {
                    legacyCount = parseInt(countMatch[1].replace(/,/g, ''), 10);
                }
            } catch (e: any) {
                console.error("Legacy fetch failed", e);
                if (e.message?.includes('SSL') || e.code?.includes('SSL')) {
                    console.error("DETAILED SSL ERROR DETECTED in server-side fetch to legacy system.");
                }
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
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Origin': 'https://rapidreportingsa.co.za',
                    'Referer': 'https://rapidreportingsa.co.za/WORKING/ob.php'
                },
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
            console.error(`Error in legacy-api [${action}]:`, error);
            let message = error.message || 'An unexpected error occurred in the legacy API connector.';
            if (error.message?.includes('SSL') || error.code?.includes('SSL')) {
                message = "Secure connection to legacy system failed (SSL Error). The reporting server might have outdated security settings.";
            }
            res.status(500).json({ 
                error: 'Internal Server Error', 
                message
            });
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
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Origin': 'https://rapidreportingsa.co.za',
                    'Referer': 'https://rapidreportingsa.co.za/WORKING/ob.php'
                },
                body: formData.toString()
            });

            if (!legacyRes.ok) {
                const text = await legacyRes.text().catch(() => '');
                const snippet = text.replace(/<[^>]*>/g, ' ').substring(0, 150).trim();
                throw new Error(`Legacy system status ${legacyRes.status}${snippet ? ': ' + snippet : ''}`);
            }

            res.status(200).json({ success: true, message: 'Added successfully to legacy database' });
        } catch (error: any) {
            console.error(`Error in legacy-api [${action}]:`, error);
            res.status(500).json({ error: 'Internal Server Error', message: error.message });
        }
        return;
    }

    if (action === 'edit' && req.method === 'POST') {
        try {
            const data = req.body;
            const rawId = String(data.id).startsWith('legacy-') ? data.id.replace('legacy-', '') : data.id;

            const formData = new URLSearchParams();
            formData.append('edit-id', rawId);
            formData.append('edit-vehicle_registration', data.vehicle_registration || '');
            formData.append('edit-make', data.make || '');
            formData.append('edit-model', data.model || '');
            formData.append('edit-color', data.color || '');
            formData.append('edit-reason', data.reason || '');
            formData.append('edit-cos_name', data.cos_name || '');
            formData.append('edit-cos_contact_number', data.cos_contact_number || '');
            formData.append('edit-case_number', data.case_number || '');
            formData.append('edit-station_reported_at', data.station_reported_at || '');
            formData.append('edit-io_name', data.io_name || '');
            formData.append('edit-io_contact', data.io_contact || '');
            formData.append('edit-recovered', data.recovered || '');
            formData.append('edit-tracker', data.tracker || '');
            formData.append('edit-date_of_incident', data.date_of_incident || '');
            formData.append('submit-edit', '');

            const legacyRes = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Origin': 'https://rapidreportingsa.co.za',
                    'Referer': 'https://rapidreportingsa.co.za/WORKING/ob.php'
                },
                body: formData.toString()
            });

            if (!legacyRes.ok) {
                const text = await legacyRes.text().catch(() => '');
                const snippet = text.replace(/<[^>]*>/g, ' ').substring(0, 150).trim();
                throw new Error(`Legacy system status ${legacyRes.status}${snippet ? ': ' + snippet : ''}`);
            }

            res.status(200).json({ success: true, message: 'Updated successfully in legacy database' });
        } catch (error: any) {
            console.error(`Error in legacy-api [${action}]:`, error);
            res.status(500).json({ error: 'Internal Server Error', message: error.message });
        }
        return;
    }

    if (action === 'delete' && req.method === 'POST') {
        try {
            const { id } = req.body;
            const rawId = String(id).startsWith('legacy-') ? id.replace('legacy-', '') : id;

            const formData = new URLSearchParams();
            formData.append('delete-id', rawId);

            const legacyRes = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Origin': 'https://rapidreportingsa.co.za',
                    'Referer': 'https://rapidreportingsa.co.za/WORKING/ob.php'
                },
                body: formData.toString()
            });

            if (!legacyRes.ok) {
                const text = await legacyRes.text().catch(() => '');
                const snippet = text.replace(/<[^>]*>/g, ' ').substring(0, 150).trim();
                throw new Error(`Legacy system status ${legacyRes.status}${snippet ? ': ' + snippet : ''}`);
            }

            res.status(200).json({ success: true, message: 'Deleted successfully from legacy database' });
        } catch (error: any) {
            console.error(`Error in legacy-api [${action}]:`, error);
            res.status(500).json({ error: 'Internal Server Error', message: error.message });
        }
        return;
    }

    return res.status(404).json({ error: 'Action not found' });
}
