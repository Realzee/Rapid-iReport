import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    const SERVICE_ROLE_KEY_VAL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
    const supabaseUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    
    let supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseServiceKey || supabaseServiceKey.length < 50 || supabaseServiceKey.includes('dummy') || supabaseServiceKey === 'undefined' || supabaseServiceKey === 'null') {
        supabaseServiceKey = SERVICE_ROLE_KEY_VAL;
    }

    const supabaseAdmin = req.supabaseAdmin || createClient(supabaseUrl, supabaseServiceKey);

    const action = req.query.action || req.body?.action;

    

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
            
            const lowerReason = String(data.reason || '').toLowerCase();
            const isRecoveredStr = String(data.recovered || '').toLowerCase();
            const isRecoveredBool = data.recovered === true || data.recovered === 'Yes' || isRecoveredStr === 'yes' || isRecoveredStr === 'recovered';

            let typeParam = data.type || 'STOLEN VEHICLE';
            if (typeParam === 'STOLEN VEHICLE' || typeParam === 'vehicle') {
                if (isRecoveredBool) {
                    typeParam = 'RECOVERY LOG';
                } else if (lowerReason.includes('hijack')) {
                    typeParam = 'HIJACKING';
                } else if (lowerReason.includes('theft out of')) {
                    typeParam = 'THEFT OUT OF MOTOR VEHICLE';
                } else {
                    typeParam = 'STOLEN VEHICLE';
                }
            }

            let recoveredParam = 'STOLEN';
            if (isRecoveredBool) {
                recoveredParam = 'RECOVERED';
            } else if (isRecoveredStr === 'pending') {
                recoveredParam = 'PENDING';
            }

            formData.append('type', typeParam);
            formData.append('company', data.company || '');
            formData.append('vehicle_registration', data.vehicle_registration || '');
            formData.append('make', data.make || '');
            formData.append('model', data.model || '');
            formData.append('vin_number', data.vin_number || '');
            formData.append('engine_number', data.engine_number || '');
            formData.append('color', data.color || '');
            formData.append('cos_name', data.cos_name || '');
            formData.append('cos_contact_number', data.cos_contact_number || '');
            formData.append('case_number', data.case_number || '');
            formData.append('station_reported_at', data.station_reported_at || '');
            formData.append('io_name', data.io_name || '');
            formData.append('io_contact', data.io_contact || '');
            formData.append('date_of_incident', data.date_of_incident || new Date().toISOString().split('T')[0]);
            formData.append('tracker', data.tracker || '');
            formData.append('recovered', recoveredParam);
            formData.append('reason', data.reason || '');
            formData.append('entry_text', data.entry_text || data.reason || 'Auto-entered entry from Rapid911 system.');

            const legacyRes = await fetch('https://rapidreportingsa.co.za/process_vehicle.php', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Origin': 'https://rapidreportingsa.co.za',
                    'Referer': 'https://rapidreportingsa.co.za/UltimateRegApp.html'
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
            formData.append('edit-company', data.company || '');
            formData.append('edit-vehicle_registration', data.vehicle_registration || '');
            formData.append('edit-make', data.make || '');
            formData.append('edit-model', data.model || '');
            formData.append('edit-vin_number', data.vin_number || '');
            formData.append('edit-engine_number', data.engine_number || '');
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
