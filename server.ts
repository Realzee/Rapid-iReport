import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

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

app.use(express.json());

// API Routes for User Management
app.post('/api/users/create', async (req, res) => {
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
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/users/reset-password', async (req, res) => {
    const { userId, password } = req.body;
    
    try {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password
        });

        if (error) throw error;
        res.status(200).json(data);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/users/delete', async (req, res) => {
    const { userId } = req.body;
    
    try {
        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) throw error;
        res.status(200).json(data);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Vite middleware for development
async function setupVite() {
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static('dist'));
        app.get('*', (req, res) => {
            res.sendFile('dist/index.html', { root: '.' });
        });
    }
}

setupVite().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});
