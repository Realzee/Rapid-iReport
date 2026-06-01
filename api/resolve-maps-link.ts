import { Request, Response } from 'express';

const extractCoordsFromUrl = (url: string): { lat: number; lng: number } | null => {
    // 1. Check for @lat,lng pattern (most common in Google Maps)
    const atRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const atMatch = url.match(atRegex);
    if (atMatch && atMatch[1] && atMatch[2]) {
        return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
    }

    // 2. Check for query parameter q=lat,lng or query=lat,lng
    const qRegex = /[?&](?:q|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
    const qMatch = url.match(qRegex);
    if (qMatch && qMatch[1] && qMatch[2]) {
        return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
    }

    // 3. Look for ll=lat,lng
    const llRegex = /ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
    const llMatch = url.match(llRegex);
    if (llMatch && llMatch[1] && llMatch[2]) {
        return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
    }

    // 4. Fallback search for any "lat,lng" matching numbers
    const fallbackRegex = /(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/;
    const fallbackMatch = url.match(fallbackRegex);
    if (fallbackMatch && fallbackMatch[1] && fallbackMatch[2]) {
        const lat = parseFloat(fallbackMatch[1]);
        const lng = parseFloat(fallbackMatch[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { lat, lng };
        }
    }

    return null;
};

export default async function handler(req: Request, res: Response) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        let finalUrl = url;
        
        // If it looks like a shortened URL (goo.gl, maps.app.goo.gl, maps.google.com, etc.)
        if (url.includes('goo.gl') || url.includes('maps.app.goo.gl') || url.includes('t.co') || url.includes('bit.ly') || url.includes('tinyurl')) {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 8000);
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    },
                    signal: controller.signal
                });
                clearTimeout(id);
                finalUrl = response.url;
            } catch (fetchErr) {
                clearTimeout(id);
                console.error('Failed to follow shortened URL redirect:', fetchErr);
            }
        }

        // Try extracting coordinates from final URL
        const coords = extractCoordsFromUrl(finalUrl);
        if (!coords) {
            return res.status(422).json({ error: 'Could not extract coordinates from the maps link.' });
        }

        // Reverse geocode server-side using Nominatim
        let address = '';
        try {
            const reverseResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`, {
                headers: {
                    'User-Agent': 'Rapid-IReport-App/1.0 (mzwelisto@gmail.com)'
                }
            });
            if (reverseResponse.ok) {
                const data = await reverseResponse.json();
                address = data.display_name || '';
            }
        } catch (reverseErr) {
            console.error('Nominatim reverse geocode failed on server:', reverseErr);
        }

        return res.status(200).json({
            coords,
            address: address || `Coordinates: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
            finalUrl
        });

    } catch (e: any) {
        console.error('Error resolving maps link:', e);
        return res.status(500).json({ error: 'Failed to resolve maps link.', details: e.message });
    }
}
