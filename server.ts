import express from 'express';
console.log('Starting server.ts...');
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

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

const getSafeSupabaseUrl = (url: string | undefined): string => {
    const defaultUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    if (!url || url === 'undefined' || url.trim() === '') return defaultUrl;
    const trimmed = url.trim();
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
};

const supabaseUrl = getSafeSupabaseUrl(process.env.SUPABASE_URL);
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not set. Administrative features will be limited.');
}

// Ensure createClient doesn't crash the server start if URL is invalid
let supabaseAdmin: any = null;
try {
    if (supabaseUrl && !supabaseUrl.includes('undefined')) {
        supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '', {
            auth: { autoRefreshToken: false, persistSession: false }
        });
    }
} catch (e) {
    console.error('Failed to initialize supabaseAdmin:', e);
}

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running', timestamp: new Date().toISOString(), supabaseUrl: supabaseUrl.replace(/:\/\/.*@/, '://***@') });
});

// Dynamic API Route Loader
const apiDir = path.resolve(currentDir, 'api');
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
                    console.log(`[API CALL] ${req.method} ${req.url} (Matched: ${routePath})`);
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
// In Express 5, * must be named or expressed as a regex. (.*) is a common way to express it.
app.all('/api/(.*)', (req, res) => {
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
        app.get('(.*)', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }
}

setupFrontend().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
});
