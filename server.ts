import express from 'express';
console.log('Starting server.ts...');
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

dotenv.config({ override: true });

// Ensure correct service role key is loaded into environment variables for all API endpoints
const SERVICE_ROLE_KEY_VAL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY_VAL;
process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY_VAL;

// Use process.cwd() as the project root, which is consistent for Node.js applications.
const currentDir = process.cwd();

const app = express();
const PORT = 3000;

// Global request logger
app.use((req, res, next) => {
    if (req.url.startsWith('/api') || req.headers.accept?.includes('text/html')) {
        const timestamp = new Date().toISOString();
        const host = req.headers.host || 'unknown';
        console.log(`[${timestamp}] ${req.method} ${req.url} (Host: ${host})`);
    }
    next();
});

const getSafeSupabaseUrl = (url: string | undefined): string => {
    const defaultUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    if (!url || url === 'undefined' || url.trim() === '') return defaultUrl;
    const trimmed = url.trim();
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
};

const supabaseUrl = getSafeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);

let supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!supabaseServiceKey || supabaseServiceKey.length < 50 || supabaseServiceKey.includes('dummy') || supabaseServiceKey === 'undefined' || supabaseServiceKey === 'null') {
    supabaseServiceKey = SERVICE_ROLE_KEY_VAL;
}

if (!supabaseServiceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY and fallback keys are not set. Administrative features will be limited.');
}

// Ensure createClient doesn't crash the server start if URL or key is invalid
let supabaseAdmin: any = null;
try {
    if (supabaseUrl && !supabaseUrl.includes('undefined') && supabaseServiceKey && supabaseServiceKey.trim() !== '') {
        supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
    }
} catch (e) {
    console.error('Failed to initialize supabaseAdmin:', e);
}

// Tech Operations migrations
async function runMigrations() {
    if (!supabaseAdmin) return;
    console.log('Running system migrations for Tech Ops module...');
    const queries = [
        "ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'technician';",
        `CREATE TABLE IF NOT EXISTS public.tech_jobs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
            title text NOT NULL,
            description text,
            status text NOT NULL DEFAULT 'pending',
            severity text NOT NULL DEFAULT 'medium',
            location text,
            location_coords jsonb DEFAULT '{"lat": -26.2041, "lng": 28.0473}'::jsonb,
            assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
            reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
            parts_logged jsonb DEFAULT '[]'::jsonb,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );`,
        "ALTER TABLE public.tech_jobs ENABLE ROW LEVEL SECURITY;",
        "DROP POLICY IF EXISTS \"Allow select tech_jobs for authenticated\" ON public.tech_jobs;",
        "CREATE POLICY \"Allow select tech_jobs for authenticated\" ON public.tech_jobs FOR SELECT TO authenticated USING (true);",
        "DROP POLICY IF EXISTS \"Allow insert tech_jobs for authenticated\" ON public.tech_jobs;",
        "CREATE POLICY \"Allow insert tech_jobs for authenticated\" ON public.tech_jobs FOR INSERT TO authenticated WITH CHECK (true);",
        "DROP POLICY IF EXISTS \"Allow update tech_jobs for authenticated\" ON public.tech_jobs;",
        "CREATE POLICY \"Allow update tech_jobs for authenticated\" ON public.tech_jobs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);",
        "DROP POLICY IF EXISTS \"Allow delete tech_jobs for authenticated\" ON public.tech_jobs;",
        "CREATE POLICY \"Allow delete tech_jobs for authenticated\" ON public.tech_jobs FOR DELETE TO authenticated USING (true);",
        `CREATE TABLE IF NOT EXISTS public.tech_chat_messages (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            job_id uuid REFERENCES public.tech_jobs(id) ON DELETE CASCADE,
            sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
            content text NOT NULL,
            created_at timestamptz DEFAULT now()
        );`,
        "ALTER TABLE public.tech_chat_messages ENABLE ROW LEVEL SECURITY;",
        "DROP POLICY IF EXISTS \"Allow select tech_chat for authenticated\" ON public.tech_chat_messages;",
        "CREATE POLICY \"Allow select tech_chat for authenticated\" ON public.tech_chat_messages FOR SELECT TO authenticated USING (true);",
        "DROP POLICY IF EXISTS \"Allow insert tech_chat for authenticated\" ON public.tech_chat_messages;",
        "CREATE POLICY \"Allow insert tech_chat for authenticated\" ON public.tech_chat_messages FOR INSERT TO authenticated WITH CHECK (true);",
        "ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bolo_background_url text;",
        "ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS alias text;",
        "ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS allowed_modules text[];",
        "UPDATE public.companies SET allowed_modules = ARRAY['controller', 'tech_ops', 'fleet_management', 'guard_monitoring', 'gate_access', 'attendance', 'analytics', 'archives'] WHERE allowed_modules IS NULL;",
        "UPDATE public.companies SET allowed_modules = array_append(allowed_modules, 'fleet_management') WHERE allowed_modules IS NOT NULL AND NOT ('fleet_management' = ANY(allowed_modules));",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS cos_name text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS cos_contact_number text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS date_of_incident date;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS tracker_company text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS vehicle_involved boolean DEFAULT true;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS suspect_license_plate text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS suspect_vehicle_make text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS suspect_vehicle_model text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS suspect_vehicle_color text;",
        "ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS date_of_incident date;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS date_of_incident date;",
        `CREATE TABLE IF NOT EXISTS public.report_shares (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            report_id uuid NOT NULL,
            report_type text NOT NULL,
            source_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
            target_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
            status text NOT NULL DEFAULT 'pending',
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now(),
            CONSTRAINT unique_report_target UNIQUE (report_id, target_company_id)
        );`,
        "ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;",
        "DROP POLICY IF EXISTS \"Allow select for authenticated report_shares\" ON public.report_shares;",
        "CREATE POLICY \"Allow select for authenticated report_shares\" ON public.report_shares FOR SELECT TO authenticated USING (true);",
        "DROP POLICY IF EXISTS \"Allow insert for authenticated report_shares\" ON public.report_shares;",
        "CREATE POLICY \"Allow insert for authenticated report_shares\" ON public.report_shares FOR INSERT TO authenticated WITH CHECK (true);",
        "DROP POLICY IF EXISTS \"Allow update for authenticated report_shares\" ON public.report_shares;",
        "CREATE POLICY \"Allow update for authenticated report_shares\" ON public.report_shares FOR UPDATE TO authenticated USING (true) WITH CHECK (true);",
        "DROP POLICY IF EXISTS \"Allow delete for authenticated report_shares\" ON public.report_shares;",
        "CREATE POLICY \"Allow delete for authenticated report_shares\" ON public.report_shares FOR DELETE TO authenticated USING (true);",
        `CREATE TABLE IF NOT EXISTS public.notifications (
            id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            recipient_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            type text NOT NULL,
            title text NOT NULL,
            message text NOT NULL,
            reference_id uuid,
            is_read boolean DEFAULT false,
            created_at timestamp with time zone DEFAULT now()
        );`,
        "ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;",
        "DROP POLICY IF EXISTS \"Allow select for authenticated notifications\" ON public.notifications;",
        "CREATE POLICY \"Allow select for authenticated notifications\" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = recipient_user_id);",
        "DROP POLICY IF EXISTS \"Allow insert for authenticated notifications\" ON public.notifications;",
        "CREATE POLICY \"Allow insert for authenticated notifications\" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);",
        "DROP POLICY IF EXISTS \"Allow update for authenticated notifications\" ON public.notifications;",
        "CREATE POLICY \"Allow update for authenticated notifications\" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = recipient_user_id) WITH CHECK (auth.uid() = recipient_user_id);",
        "DROP POLICY IF EXISTS \"Allow delete for authenticated notifications\" ON public.notifications;",
        "CREATE POLICY \"Allow delete for authenticated notifications\" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = recipient_user_id);",
        "NOTIFY pgrst, 'reload schema';",
        "SELECT pg_notify('pgrst', 'reload schema');"
    ];

    for (const q of queries) {
        try {
            const { error } = await supabaseAdmin.rpc('eval', { query: q });
            if (error) {
                console.log(`[Tech Ops Migrations] Error executing: "${q.substring(0, 45)}..." ->`, error.message);
            } else {
                console.log(`[Tech Ops Migrations] Executed: "${q.substring(0, 45)}..."`);
            }
        } catch (e: any) {
            console.error('[Tech Ops Migrations] Error:', e.message);
        }
    }
}
runMigrations();

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running', timestamp: new Date().toISOString(), supabaseUrl: supabaseUrl.replace(/:\/\/.*@/, '://***@') });
});

// Specific API Route Aliases for consolidated endpoints
const ALIASES: Record<string, string> = {
    '/api/update-profile': 'profiles',
    '/api/update-setting': 'companies',
    '/api/reverse-geocode': 'geocode'
};

// Dynamic API Route Loader
const apiDir = process.env.NODE_ENV === 'production' 
    ? path.resolve(currentDir, 'dist', 'api') 
    : path.resolve(currentDir, 'api');

for (const [aliasPath, targetFileBase] of Object.entries(ALIASES)) {
    app.all([aliasPath, `${aliasPath}/`], async (req, res) => {
        try {
            const ext = process.env.NODE_ENV === 'production' ? 'cjs' : 'ts';
            const fileName = `${targetFileBase}.${ext}`;
            const modulePath = path.resolve(apiDir, fileName);
            const { default: handler } = await import(pathToFileURL(modulePath).href);
            if (typeof handler === 'function') {
                (req as any).supabaseAdmin = supabaseAdmin;
                await handler(req, res);
            } else {
                res.status(500).json({ error: 'Invalid API handler' });
            }
        } catch (error: any) {
            console.error(`Error in Aliased API route ${aliasPath}:`, error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
}

if (fs.existsSync(apiDir)) {
    console.log(`Loading API routes from ${apiDir}...`);
    const files = fs.readdirSync(apiDir, { recursive: true }) as string[];
    for (const file of files) {
        if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.cjs')) {
            const relativePath = file.replace(/\.(ts|js|cjs)$/, '');
            const routeName = relativePath.split(path.sep).join('/');
            const routePath = `/api/${routeName}`;
            
            console.log(`Registering route: ${routePath}`);
            
            // Match exactly /api/route and /api/route/
            app.all([routePath, `${routePath}/`], async (req, res) => {
                try {
                    const modulePath = path.resolve(apiDir, file);
                    // Use pathToFileURL for safe dynamic import on all platforms
                    const { default: handler } = await import(pathToFileURL(modulePath).href);
                    if (typeof handler === 'function') {
                        // Pass supabaseAdmin to the handler if it needs it (as a property on req)
                        (req as any).supabaseAdmin = supabaseAdmin;
                        await handler(req, res);
                    } else {
                        console.error(`Handler in ${file} is not a function`);
                        res.status(500).json({ error: 'Invalid API handler' });
                    }
                } catch (error: any) {
                    console.error(`Error in API route ${routePath}:`, error);
                    res.status(500).json({ 
                        error: 'Internal Server Error', 
                        message: error.message,
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    });
                }
            });
        }
    }
} else {
    console.warn(`API directory not found at ${apiDir}`);
}

// Catch-all for /api that doesn't match
app.use('/api', (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[API 404] ${req.method} ${req.originalUrl} at ${timestamp}`);
    
    // List available routes for debugging
    const availableRoutes = fs.existsSync(apiDir) 
        ? fs.readdirSync(apiDir).map(f => `/api/${f.replace(/\.(ts|js)$/, '')}`)
        : [];

    res.status(404).json({ 
        error: 'API Route Not Found', 
        method: req.method,
        path: req.originalUrl,
        message: `The requested API endpoint ${req.method} ${req.originalUrl} does not exist.`,
        availableRoutes,
        timestamp
    });
});

// Vite middleware for development or static serving for production
async function setupFrontend() {
    if (process.env.NODE_ENV !== 'production') {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
        
        // Add a catch-all for development mode to handle SPA fallback
        app.use(async (req, res, next) => {
            if (req.method !== 'GET' || !req.headers.accept?.includes('text/html')) {
                return res.status(404).json({ error: 'Not found' });
            }
            try {
                const url = req.originalUrl;
                let template = await import('fs').then(fs => fs.readFileSync(path.resolve(currentDir, 'index.html'), 'utf-8'));
                template = await vite.transformIndexHtml(url, template);
                res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
            } catch (e) {
                vite.ssrFixStacktrace(e as Error);
                next(e);
            }
        });
        
        // Error handler middleware
        app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
            console.error('Server Error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        });
    } else {
        const distPath = path.resolve(currentDir, 'dist');
        app.use(express.static(distPath));
        app.use((req, res, next) => {
            if (req.method === 'GET') {
                res.sendFile(path.join(distPath, 'index.html'));
            } else {
                next();
            }
        });
    }
}

setupFrontend().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
});
