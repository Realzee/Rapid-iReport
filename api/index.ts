import express from 'express';
import { createClient } from '@supabase/supabase-js';

// Import all handlers statically
import adminUsersHandler from './_api_handlers/admin-users.js';
import aiInsightsHandler from './_api_handlers/ai-insights.js';
import announcementsHandler from './_api_handlers/announcements.js';
import checkDbHandler from './_api_handlers/check-db.js';
import companiesHandler from './_api_handlers/companies.js';
import geocodeHandler from './_api_handlers/geocode.js';
import guardMonitoringHandler from './_api_handlers/guard-monitoring.js';
import healthHandler from './_api_handlers/health.js';
import legacyApiHandler from './_api_handlers/legacy-api.js';
import profilesHandler from './_api_handlers/profiles.js';
import resetPasswordHandler from './_api_handlers/reset-password.js';
import resolveMapsLinkHandler from './_api_handlers/resolve-maps-link.js';
import sapsBoundariesHandler from './_api_handlers/saps-boundaries.js';
import databaseBackupHandler from './_api_handlers/database-backup.js';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Setup supabaseAdmin
const SERVICE_ROLE_KEY_VAL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
const supabaseUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co';
let supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (!supabaseServiceKey || supabaseServiceKey.length < 50 || supabaseServiceKey.includes('dummy') || supabaseServiceKey === 'undefined' || supabaseServiceKey === 'null') {
    supabaseServiceKey = SERVICE_ROLE_KEY_VAL;
}

let supabaseAdmin: any = null;
try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
} catch (e) {
    console.error('Failed to initialize supabaseAdmin in api/index.ts:', e);
}

// Middleware to inject supabaseAdmin
app.use((req: any, res, next) => {
    req.supabaseAdmin = supabaseAdmin;
    next();
});

// Helper wrapper to handle asynchronous errors in route handlers
const handle = (handler: any) => async (req: any, res: any) => {
    try {
        await handler(req, res);
    } catch (err: any) {
        console.error('API Error:', err);
        res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
};

// Map paths exactly, both with and without trailing slash
app.all(['/api/admin-users', '/api/admin-users/'], handle(adminUsersHandler));
app.all(['/api/ai-insights', '/api/ai-insights/'], handle(aiInsightsHandler));
app.all(['/api/announcements', '/api/announcements/'], handle(announcementsHandler));
app.all(['/api/check-db', '/api/check-db/'], handle(checkDbHandler));
app.all(['/api/companies', '/api/companies/'], handle(companiesHandler));
app.all(['/api/geocode', '/api/geocode/'], handle(geocodeHandler));
app.all(['/api/guard-monitoring', '/api/guard-monitoring/'], handle(guardMonitoringHandler));
app.all(['/api/health', '/api/health/'], handle(healthHandler));
app.all(['/api/legacy-api', '/api/legacy-api/'], handle(legacyApiHandler));
app.all(['/api/profiles', '/api/profiles/'], handle(profilesHandler));
app.all(['/api/reset-password', '/api/reset-password/'], handle(resetPasswordHandler));
app.all(['/api/resolve-maps-link', '/api/resolve-maps-link/'], handle(resolveMapsLinkHandler));
app.all(['/api/saps-boundaries', '/api/saps-boundaries/'], handle(sapsBoundariesHandler));
app.all(['/api/database-backup', '/api/database-backup/'], handle(databaseBackupHandler));

// Specific API Route Aliases for consolidated endpoints
app.all(['/api/update-profile', '/api/update-profile/'], handle(profilesHandler));
app.all(['/api/update-setting', '/api/update-setting/'], handle(companiesHandler));
app.all(['/api/reverse-geocode', '/api/reverse-geocode/'], handle(geocodeHandler));

// Catch-all 404 for unmapped API routes
app.use('/api', (req, res) => {
    res.status(404).json({
        error: 'API Route Not Found',
        method: req.method,
        path: req.originalUrl,
        message: `The requested API endpoint ${req.method} ${req.originalUrl} does not exist.`
    });
});

export default app;
