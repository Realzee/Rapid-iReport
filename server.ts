import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running', timestamp: new Date().toISOString() });
});

// API Routes for User Management
app.post('/api/create-user', async (req, res) => {
    const { email, password, user_metadata } = req.body;
    
    try {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            user_metadata,
            email_confirm: true
        });

        if (error) throw error;
        res.status(200).json(data);
    } catch (error: any) {
        console.error('Error creating user:', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { userId, password } = req.body;
    
    try {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password
        });

        if (error) throw error;
        res.status(200).json(data);
    } catch (error: any) {
        console.error('Error resetting password:', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/delete-user', async (req, res) => {
    const { userId } = req.body;
    
    try {
        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) throw error;
        res.status(200).json(data);
    } catch (error: any) {
        console.error('Error deleting user:', error);
        res.status(400).json({ error: error.message });
    }
});

// Catch-all for /api that doesn't match
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
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
    } else {
        const distPath = path.resolve(__dirname, 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }
}

setupFrontend().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
});
