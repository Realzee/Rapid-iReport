import express from 'express';
console.log('Starting server.ts...');
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

// Fix for CJS bundling where import.meta.url is not available
const currentFile = typeof import.meta !== 'undefined' && import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : '');
const currentDir = currentFile ? path.dirname(currentFile) : (typeof __dirname !== 'undefined' ? __dirname : process.cwd());

const app = express();
const PORT = 3000;

// Global request logger
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const host = req.headers.host;
    console.log(`[${timestamp}] ${req.method} ${req.url} (Host: ${host})`);
    next();
});

const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not set. Administrative tasks will fail.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '', {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Telegram Bot Logic
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramGroupId = process.env.TELEGRAM_GROUP_ID;

if (telegramToken && telegramGroupId) {
    const bot = new TelegramBot(telegramToken, { polling: false });
    console.log('Telegram bot initialized.');

    let lastChecked = new Date();
    
    // Check every minute
    setInterval(async () => {
        try {
            console.log('Telegram bot polling for new reports...');
            const now = new Date();
            // Fetch potential new vehicle reports
            const { data: vehicleReports, error: supabaseError } = await (supabaseAdmin as any)
                .from('vehicle_reports')
                .select('*')
                .gt('reported_at', lastChecked.toISOString())
                .order('reported_at', { ascending: true });

            if (supabaseError) {
                console.error('Supabase error in Telegram bot polling:', supabaseError);
                return;
            }

            if (vehicleReports && vehicleReports.length > 0) {
                console.log(`Found ${vehicleReports.length} new reports.`);
                for (const report of vehicleReports) {
                    try {
                        const message = `🚨 *New ${report.is_wanted ? 'WANTED' : 'Reported'} Vehicle* 🚨\n\n` +
                            `*Plate:* ${report.license_plate}\n` +
                            `*Make/Model:* ${report.vehicle_make} ${report.vehicle_model}\n` +
                            `*Color:* ${report.vehicle_color}\n` +
                            `*Last Seen:* ${report.last_seen_location}\n` +
                            `*Description:* ${report.description}\n`;
                        await bot.sendMessage(telegramGroupId, message, { parse_mode: 'Markdown' });
                        console.log(`Sent alert for license plate: ${report.license_plate}`);
                    } catch (botError) {
                        console.error('Error sending Telegram message:', botError);
                    }
                }
            }
            lastChecked = now;
        } catch (e) {
            console.error('Error in Telegram bot polling:', e);
        }
    }, 60000);
}

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running', timestamp: new Date().toISOString() });
});

// Dynamic API Route Loader
const apiDir = path.resolve(currentDir, 'api');
if (fs.existsSync(apiDir)) {
    console.log(`Loading API routes from ${apiDir}...`);
    const files = fs.readdirSync(apiDir);
    for (const file of files) {
        if (file.endsWith('.ts') || file.endsWith('.js')) {
            const routeName = file.replace(/\.(ts|js)$/, '');
            const routePath = `/api/${routeName}`;
            
            console.log(`Registering route: ${routePath}`);
            
            app.all([routePath, `${routePath}/`], async (req, res) => {
                try {
                    const modulePath = path.resolve(apiDir, file);
                    console.log(`[API CALL] ${req.method} ${req.url} (Matched: ${routePath})`);
                    // Use dynamic import to load the handler
                    // We use a query param to avoid cache in dev if needed, but tsx handles this well
                    const { default: handler } = await import(`file://${modulePath}`);
                    if (typeof handler === 'function') {
                        await handler(req, res);
                    } else {
                        console.error(`Handler in ${file} is not a function`);
                        res.status(500).json({ error: 'Invalid API handler' });
                    }
                } catch (error: any) {
                    console.error(`Error in API route ${routePath}:`, error);
                    res.status(500).json({ error: 'Internal Server Error', message: error.message });
                }
            });
        }
    }
} else {
    console.warn(`API directory not found at ${apiDir}`);
}

// Catch-all for /api that doesn't match
app.all('/api/:any*', (req, res) => {
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
        app.get('/:any*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }
}

setupFrontend().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
});
