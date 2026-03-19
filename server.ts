import express from 'express';
console.log('Starting server.ts...');
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';

if (!supabaseServiceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not set. Administrative tasks will fail.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '', {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running', timestamp: new Date().toISOString() });
});

// Dynamic API Route Loader
const apiDir = path.resolve(__dirname, 'api');
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
app.all('/api/*', (req, res) => {
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
                let template = await import('fs').then(fs => fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8'));
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
        const distPath = path.resolve(__dirname, 'dist');
        app.use(express.static(distPath));
        app.get(/(.*)/, (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }
}

setupFrontend().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
});
