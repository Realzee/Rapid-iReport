import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const q = (req.query.q || req.body.q) as string;
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return res.status(200).json([]);
    }

    const limit = (req.query.limit || req.body.limit || '5') as string;
    
    const doSearch = async (searchQuery: string) => {
        // Enforce South Africa with countrycodes=za
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&polygon_geojson=1&countrycodes=za&limit=${limit}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Rapid-IReport-App/1.0 (mzwelisto@gmail.com)',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        if (!response.ok) {
            throw new Error(`Nominatim failed with status ${response.status}`);
        }
        return await response.json();
    };

    try {
        let results = await doSearch(q);
        
        // Smart fallback logic for pasted addresses:
        // If no results and the pasted address contains commas,
        // try successively stripping more specific parts (like Unit/Apartment details) from the left
        if ((!results || results.length === 0) && q.includes(',')) {
            const parts = q.split(',').map(p => p.trim()).filter(Boolean);
            
            // Try removing the first part (e.g., "Unit 23A", "Room 400", "Block C")
            if (parts.length > 2) {
                const subQuery = parts.slice(1).join(', ');
                try {
                    const fallbackResults = await doSearch(subQuery);
                    if (fallbackResults && fallbackResults.length > 0) {
                        results = fallbackResults;
                    }
                } catch (e) {
                    console.error("Geocode fallback 1 failed:", e);
                }
            }
            
            // If still no results, try to search for the last 2-3 parts (typically street, city, country)
            if ((!results || results.length === 0) && parts.length > 2) {
                const subQuery = parts.slice(-3).join(', '); // take street, city, country/state
                try {
                    const fallbackResults2 = await doSearch(subQuery);
                    if (fallbackResults2 && fallbackResults2.length > 0) {
                        results = fallbackResults2;
                    }
                } catch (e) {
                    console.error("Geocode fallback 2 failed:", e);
                }
            }
        }

        return res.status(200).json(results || []);
    } catch (error: any) {
        console.error("Error in server geocode handler:", error);
        return res.status(500).json({ error: "Failed to geocode address", details: error.message });
    }
}
