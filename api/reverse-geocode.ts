import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const lat = (req.query.lat || req.body.lat) as string;
    const lng = (req.query.lng || req.body.lng || req.query.lon || req.body.lon) as string;

    if (!lat || !lng) {
        return res.status(400).json({ error: 'lat and lng parameters are required' });
    }

    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Rapid-IReport-App/1.0 (mzwelisto@gmail.com)',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Nominatim reverse geocode failed with status ${response.status}` });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error: any) {
        console.error("Error in server reverse-geocode handler:", error);
        return res.status(500).json({ error: "Failed to reverse geocode", details: error.message });
    }
}
