import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export default async function handler(req: Request, res: Response) {
    try {
        const filePath = path.join(process.cwd(), 'data', 'saps_gauteng.json');
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'SAPS Gauteng dataset not found' });
        }
        
        const data = fs.readFileSync(filePath, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        return res.send(data);
    } catch (error: any) {
        console.error('Error serving SAPS Gauteng boundaries:', error);
        return res.status(500).json({ error: 'Internal server error while loading boundaries' });
    }
}
