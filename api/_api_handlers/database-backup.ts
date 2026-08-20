import { createClient } from '@supabase/supabase-js';

const SERVICE_ROLE_KEY_VAL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
const supabaseUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co';

let supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (!supabaseServiceKey || supabaseServiceKey.length < 50 || supabaseServiceKey.includes('dummy') || supabaseServiceKey === 'undefined' || supabaseServiceKey === 'null') {
    supabaseServiceKey = SERVICE_ROLE_KEY_VAL;
}

// Table registry in strict topological dependency order (parents before children)
export const REGISTERED_TABLES: { name: string; label: string; primaryKey: string; category: string; description: string }[] = [
    { name: 'companies', label: 'Companies & Organizations', primaryKey: 'id', category: 'Core', description: 'Security companies, logos, psira & branding configuration' },
    { name: 'profiles', label: 'User Profiles', primaryKey: 'id', category: 'Core', description: 'Accounts, credentials, responder telemetry, roles & permissions' },
    { name: 'app_settings', label: 'Application Settings', primaryKey: 'key', category: 'System', description: 'Global system configuration, keys & system preferences' },
    { name: 'announcements', label: 'Global Announcements', primaryKey: 'id', category: 'System', description: 'Notices, safety tips, broadcasts & system banners' },
    { name: 'sites', label: 'Guarding Sites', primaryKey: 'id', category: 'Guarding', description: 'Monitored premises, geofences & client properties' },
    { name: 'supervisors', label: 'Site Supervisors', primaryKey: 'id', category: 'Guarding', description: 'Guard managers and sector field supervisors' },
    { name: 'guards', label: 'Guards & Officers', primaryKey: 'id', category: 'Guarding', description: 'Active guard profiles, PSIRA grades and shift allocations' },
    { name: 'routes', label: 'Patrol Routes', primaryKey: 'id', category: 'Guarding', description: 'Predefined guard patrol sequences and route paths' },
    { name: 'checkpoints', label: 'Patrol Checkpoints', primaryKey: 'id', category: 'Guarding', description: 'QR codes, NFC tags & GPS coordinates for patrols' },
    { name: 'tracking_units', label: 'Fleet & Tracking Units', primaryKey: 'id', category: 'Fleet', description: 'Vehicles, GPS trackers, IMEI telemetry and cut-off status' },
    { name: 'vehicle_reports', label: 'Vehicle Incidents (BOLO)', primaryKey: 'id', category: 'Incidents', description: 'Stolen, suspicious, flagged vehicles and recovery records' },
    { name: 'crime_reports', label: 'Crime Incident Reports', primaryKey: 'id', category: 'Incidents', description: 'Community crime logs, severity, suspects & case status' },
    { name: 'emergency_reports', label: 'Emergency & Panic Alerts', primaryKey: 'id', category: 'Incidents', description: 'Live SOS dispatches, distress coordinates & responder calls' },
    { name: 'report_updates', label: 'Incident Updates & Notes', primaryKey: 'id', category: 'Incidents', description: 'Progress entries, dispatch logs and investigator notes' },
    { name: 'report_shares', label: 'Corporate Report Shares', primaryKey: 'id', category: 'Incidents', description: 'Cross-company shared report intelligence records' },
    { name: 'chat_messages', label: 'Incident Chat Logs', primaryKey: 'id', category: 'Communication', description: 'Real-time collaborative messages and incident thread discussions' },
    { name: 'assignment_logs', label: 'Responder Assignment Logs', primaryKey: 'id', category: 'Operations', description: 'Audit trail of incident dispatching and handovers' },
    { name: 'notifications', label: 'User Notifications', primaryKey: 'id', category: 'Communication', description: 'System alerts, dispatch notices and read receipts' },
    { name: 'user_activity_logs', label: 'Audit & Activity Logs', primaryKey: 'id', category: 'System', description: 'Full administrator, operator & responder security audit trail' },
    { name: 'gate_access_logs', label: 'Gate Access Logs', primaryKey: 'id', category: 'Operations', description: 'Visitor, driver license & license plate scanner entries' },
    { name: 'patrol_logs', label: 'Guard Patrol Scans', primaryKey: 'id', category: 'Guarding', description: 'Checkpoint scans, patrol timestamps and route compliance' },
    { name: 'guard_heartbeats', label: 'Guard Live Heartbeats', primaryKey: 'id', category: 'Guarding', description: 'Live guard GPS telemetry and battery status pings' },
    { name: 'tech_jobs', label: 'Technical Operations Jobs', primaryKey: 'id', category: 'TechOps', description: 'CCTV, alarm, tracking unit installation & repair dispatches' },
    { name: 'tech_chat_messages', label: 'Tech Operations Chat', primaryKey: 'id', category: 'TechOps', description: 'Communications between controllers and field technicians' },
    { name: 'attendance', label: 'Staff Clock-In Attendance', primaryKey: 'id', category: 'Operations', description: 'Biometric, GPS and selfie clock-in & clock-out timesheets' },
    { name: 'company_sequences', label: 'OB Number Sequences', primaryKey: 'company_id', category: 'System', description: 'Company-specific auto-incrementing OB occurrence book numbers' }
];

export default async function handler(req: any, res: any) {
    const supabaseAdmin = req.supabaseAdmin || createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin client not initialized.' });
    }

    const method = req.method;
    const action = (req.query.action || req.body?.action || '').toLowerCase();

    // 1. STATS: Get row counts and health for all tables
    if (method === 'GET' && action === 'stats') {
        try {
            const tableStats: any[] = [];
            let totalRecords = 0;

            for (const table of REGISTERED_TABLES) {
                try {
                    const { count, error } = await supabaseAdmin
                        .from(table.name)
                        .select('*', { count: 'exact', head: true });

                    if (error) {
                        tableStats.push({
                            ...table,
                            count: 0,
                            status: 'unreachable',
                            error: error.message
                        });
                    } else {
                        const num = count || 0;
                        totalRecords += num;
                        tableStats.push({
                            ...table,
                            count: num,
                            status: 'active'
                        });
                    }
                } catch (err: any) {
                    tableStats.push({
                        ...table,
                        count: 0,
                        status: 'error',
                        error: err.message
                    });
                }
            }

            let projectRef = 'yglwdwhwpbqawunbkzyy';
            try {
                const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
                if (match?.[1]) projectRef = match[1];
            } catch {}

            return res.status(200).json({
                status: 'healthy',
                dbHost: `db.${projectRef}.supabase.co`,
                projectRef,
                supabaseUrl,
                timestamp: new Date().toISOString(),
                totalTables: REGISTERED_TABLES.length,
                totalRecords,
                tables: tableStats
            });
        } catch (error: any) {
            console.error('Error fetching database stats:', error);
            return res.status(500).json({ error: 'Failed to fetch database stats', details: error.message });
        }
    }

    // 2. EXPORT / BACKUP: Export selected or all tables
    if ((method === 'GET' && (action === 'export' || action === 'backup')) || (method === 'POST' && action === 'export')) {
        try {
            const format = (req.query.format || req.body?.format || 'json').toLowerCase();
            const requestedTables: string[] = req.body?.tables || (req.query.tables ? String(req.query.tables).split(',') : null) || REGISTERED_TABLES.map(t => t.name);
            const userEmail = req.body?.userEmail || req.query.userEmail || 'Admin User';

            const tablesData: Record<string, any[]> = {};
            const counts: Record<string, number> = {};
            let totalRecords = 0;

            for (const table of REGISTERED_TABLES) {
                if (!requestedTables.includes(table.name)) continue;

                try {
                    // Fetch all rows with a high limit to capture full data
                    const { data, error } = await supabaseAdmin
                        .from(table.name)
                        .select('*')
                        .limit(50000);

                    if (error) {
                        console.warn(`Could not export table ${table.name}:`, error.message);
                        tablesData[table.name] = [];
                        counts[table.name] = 0;
                    } else {
                        const rows = data || [];
                        tablesData[table.name] = rows;
                        counts[table.name] = rows.length;
                        totalRecords += rows.length;
                    }
                } catch (err: any) {
                    console.warn(`Exception reading table ${table.name}:`, err.message);
                    tablesData[table.name] = [];
                    counts[table.name] = 0;
                }
            }

            const timestamp = new Date().toISOString();
            const filenameDate = timestamp.replace(/[:.]/g, '-').slice(0, 19);

            // If SQL format is requested
            if (format === 'sql') {
                let sqlScript = `-- ==========================================================================\n`;
                sqlScript += `-- Vigilix Security Monitoring System - PostgreSQL Full Database Backup Snapshot\n`;
                sqlScript += `-- Exported At: ${timestamp}\n`;
                sqlScript += `-- Exported By: ${userEmail}\n`;
                sqlScript += `-- Total Tables: ${Object.keys(tablesData).length} | Total Records: ${totalRecords}\n`;
                sqlScript += `-- ==========================================================================\n\n`;
                sqlScript += `BEGIN;\n\n`;

                for (const table of REGISTERED_TABLES) {
                    const rows = tablesData[table.name];
                    if (!rows || rows.length === 0) continue;

                    sqlScript += `-- --------------------------------------------------------------------------\n`;
                    sqlScript += `-- Table: public.${table.name} (${rows.length} records)\n`;
                    sqlScript += `-- --------------------------------------------------------------------------\n`;

                    for (const row of rows) {
                        const cols = Object.keys(row);
                        const colNames = cols.map(c => `"${c}"`).join(', ');
                        const values = cols.map(c => {
                            const val = row[c];
                            if (val === null || val === undefined) return 'NULL';
                            if (typeof val === 'boolean' || typeof val === 'number') return String(val);
                            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
                            return `'${String(val).replace(/'/g, "''")}'`;
                        }).join(', ');

                        const pk = table.primaryKey;
                        const updateSet = cols
                            .filter(c => c !== pk)
                            .map(c => `"${c}" = EXCLUDED."${c}"`)
                            .join(', ');

                        if (updateSet.length > 0 && pk && cols.includes(pk)) {
                            sqlScript += `INSERT INTO public.${table.name} (${colNames}) VALUES (${values}) ON CONFLICT ("${pk}") DO UPDATE SET ${updateSet};\n`;
                        } else {
                            sqlScript += `INSERT INTO public.${table.name} (${colNames}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
                        }
                    }
                    sqlScript += `\n`;
                }

                sqlScript += `COMMIT;\n`;
                sqlScript += `-- End of Vigilix Security Monitoring System Backup Snapshot\n`;

                res.setHeader('Content-Type', 'application/sql');
                res.setHeader('Content-Disposition', `attachment; filename="vigilix_db_backup_${filenameDate}.sql"`);
                return res.status(200).send(sqlScript);
            }

            // Default JSON format
            const backupPayload = {
                format: 'rapid-ireport-backup-v1',
                exportedAt: timestamp,
                exportedBy: userEmail,
                summary: {
                  totalTables: Object.keys(tablesData).length,
                  totalRecords,
                  counts
                },
                tables: tablesData
            };

            // If requested via browser download
            if (req.query.download === 'true') {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="rapid_ireport_db_backup_${filenameDate}.json"`);
            }

            return res.status(200).json(backupPayload);
        } catch (error: any) {
            console.error('Database export error:', error);
            return res.status(500).json({ error: 'Failed to export database', details: error.message });
        }
    }

    // 3. RESTORE: Import and restore tables from backup payload
    if (method === 'POST' && action === 'restore') {
        try {
            const { backupData, mode = 'upsert', selectedTables, userEmail, userId } = req.body;

            if (!backupData) {
                return res.status(400).json({ error: 'Missing backup data payload.' });
            }

            // Extract table records (support both structured backup with .tables object and direct table dict)
            const rawTables: Record<string, any[]> = backupData.tables || backupData;

            if (typeof rawTables !== 'object' || Object.keys(rawTables).length === 0) {
                return res.status(400).json({ error: 'Invalid backup format: No table records found.' });
            }

            const targetTableNames = selectedTables && Array.isArray(selectedTables) && selectedTables.length > 0
                ? selectedTables
                : REGISTERED_TABLES.map(t => t.name);

            const restoredCounts: Record<string, number> = {};
            const skippedCounts: Record<string, number> = {};
            const errors: Record<string, string> = {};
            let grandTotalRestored = 0;

            // Process tables strictly in registered dependency order
            for (const table of REGISTERED_TABLES) {
                if (!targetTableNames.includes(table.name)) continue;

                const rows = rawTables[table.name];
                if (!rows || !Array.isArray(rows) || rows.length === 0) {
                    skippedCounts[table.name] = 0;
                    continue;
                }

                try {
                    let tableRestored = 0;
                    const chunkSize = 50;

                    // Clean / replace mode: safely clear existing items if specifically requested
                    if (mode === 'replace' && table.name !== 'profiles') {
                        // Note: We don't wipe profiles in replace mode to prevent breaking auth sessions
                        try {
                            await supabaseAdmin.from(table.name).delete().neq('id', '00000000-0000-0000-0000-000000000000');
                        } catch (e: any) {
                            console.warn(`Could not clear table ${table.name} before restore:`, e.message);
                        }
                    }

                    for (let i = 0; i < rows.length; i += chunkSize) {
                        const chunk = rows.slice(i, i + chunkSize);
                        const pk = table.primaryKey || 'id';

                        // Upsert chunk
                        const { error: upsertError } = await supabaseAdmin
                            .from(table.name)
                            .upsert(chunk, { onConflict: pk });

                        if (upsertError) {
                            console.warn(`Batch upsert warning on ${table.name} (chunk ${i}):`, upsertError.message);
                            // Fallback: try individual rows if batch failed due to a constraint or missing column
                            for (const singleRow of chunk) {
                                try {
                                    const { error: singleError } = await supabaseAdmin
                                        .from(table.name)
                                        .upsert(singleRow, { onConflict: pk });
                                    
                                    if (!singleError) {
                                        tableRestored++;
                                    }
                                } catch {}
                            }
                        } else {
                            tableRestored += chunk.length;
                        }
                    }

                    restoredCounts[table.name] = tableRestored;
                    grandTotalRestored += tableRestored;
                } catch (err: any) {
                    console.error(`Error restoring table ${table.name}:`, err);
                    errors[table.name] = err.message;
                }
            }

            // Log activity to user_activity_logs
            try {
                if (userId) {
                    await supabaseAdmin.from('user_activity_logs').insert({
                        user_id: userId,
                        action: 'DATABASE_RESTORE',
                        details: `Admin restored ${grandTotalRestored} records across ${Object.keys(restoredCounts).length} tables (Mode: ${mode})`
                    });
                }
            } catch (logErr) {
                console.warn('Could not write database restore audit log:', logErr);
            }

            return res.status(200).json({
                success: true,
                message: `Successfully restored ${grandTotalRestored} records across ${Object.keys(restoredCounts).length} tables.`,
                mode,
                totalRestored: grandTotalRestored,
                restoredCounts,
                skippedCounts,
                errors: Object.keys(errors).length > 0 ? errors : undefined,
                timestamp: new Date().toISOString()
            });
        } catch (error: any) {
            console.error('Database restore error:', error);
            return res.status(500).json({ error: 'Failed to restore database', details: error.message });
        }
    }

    return res.status(405).json({ error: 'Method or action not allowed' });
}
