import { Request, Response } from 'express';

// Set up an in-memory cache to handle rapid keystroke rates and prevent Nominatim rate-limits
const geocodeCache = (global as any).geocodeCache || new Map<string, { data: any; timestamp: number }>();
(global as any).geocodeCache = geocodeCache;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache

export default async function handler(req: Request, res: Response) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const lat = (req.query.lat || req.body?.lat) as string;
    const lng = (req.query.lng || req.body?.lng || req.query.lon || req.body?.lon) as string;

    if (lat && lng) {
        const cacheKeyGeo = `reverse_${lat}_${lng}`;
        if (geocodeCache.has(cacheKeyGeo)) {
            const cached = geocodeCache.get(cacheKeyGeo)!;
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                return res.status(200).json(cached.data);
            }
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
                if (geocodeCache.has(cacheKeyGeo)) {
                    return res.status(200).json(geocodeCache.get(cacheKeyGeo)!.data);
                }
                return res.status(response.status).json({ error: `Nominatim reverse geocode failed with status ${response.status}` });
            }

            const data = await response.json();
            geocodeCache.set(cacheKeyGeo, { data, timestamp: Date.now() });
            return res.status(200).json(data);
        } catch (error: any) {
            console.error("Error in server reverse-geocode handler:", error);
            if (geocodeCache.has(cacheKeyGeo)) {
                return res.status(200).json(geocodeCache.get(cacheKeyGeo)!.data);
            }
            return res.status(200).json({ display_name: "South Africa" });
        }
    }

    const q = (req.query.q || req.body?.q) as string;
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return res.status(200).json([]);
    }

    const limit = (req.query.limit || req.body?.limit || '5') as string;
    const cacheKey = `search_${q.trim().toLowerCase()}_${limit}`;

    if (geocodeCache.has(cacheKey)) {
        const cached = geocodeCache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return res.status(200).json(cached.data);
        }
    }
    
    const doSearch = async (searchQuery: string) => {
        // Enforce South Africa with countrycodes=za and accept-language=en
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&polygon_geojson=1&countrycodes=za&accept-language=en&limit=${limit}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Rapid-IReport-App/1.0 (mzwelisto@gmail.com)',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        if (!response.ok) {
            throw new Error(`Nominatim failed with status ${response.status}`);
        }
        const data = await response.json();
        
        // Strict country filtering to handle any potential Nominatim ignores or fallback slippage
        if (Array.isArray(data)) {
            return data.filter((item: any) => {
                if (!item.display_name) return false;
                const displayNameLower = item.display_name.toLowerCase();
                
                // Check if the display name explicitly references South Africa cues
                const hasZaCue = displayNameLower.includes("south africa") || 
                                 displayNameLower.includes(", za") || 
                                 displayNameLower.includes("suid-afrika") || 
                                 displayNameLower.includes("south-africa") ||
                                 displayNameLower.includes("zaf");
                
                if (hasZaCue) return true;
                
                // Coordinates check for South Africa bounds: Latitude: -35 to -22, Longitude: 16 to 33
                const latVal = parseFloat(item.lat);
                const lonVal = parseFloat(item.lon);
                if (!isNaN(latVal) && !isNaN(lonVal)) {
                    if (latVal >= -35.2 && latVal <= -21.9 && lonVal >= 16.2 && lonVal <= 33.1) {
                        return true;
                    }
                }
                return false;
            });
        }
        return [];
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

        geocodeCache.set(cacheKey, { data: results || [], timestamp: Date.now() });
        return res.status(200).json(results || []);
    } catch (error: any) {
        console.warn("Error in server geocode handler, recovering with cache or empty list:", error.message);
        if (geocodeCache.has(cacheKey)) {
            return res.status(200).json(geocodeCache.get(cacheKey)!.data);
        }
        return res.status(200).json([]);
    }
}
