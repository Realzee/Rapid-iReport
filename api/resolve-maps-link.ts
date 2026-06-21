import { Request, Response } from 'express';

const extractCoordsFromUrl = (url: string): { lat: number; lng: number } | null => {
    // Decode URL to parse coordinates with URL-encoded tags like %40 (@) and %2C (,)
    let decodedUrl = url;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch (e) {
        console.warn("Failed to decode URL in extractCoordsFromUrl:", e);
    }

    // 1. Check for !3dlat!4dlng pattern (common in modern Google Maps links)
    const bangRegex = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/i;
    const bangMatch = decodedUrl.match(bangRegex);
    if (bangMatch && bangMatch[1] && bangMatch[2]) {
        return { lat: parseFloat(bangMatch[1]), lng: parseFloat(bangMatch[2]) };
    }

    // 2. Check for @lat,lng pattern (most common in Google Maps)
    const atRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const atMatch = decodedUrl.match(atRegex);
    if (atMatch && atMatch[1] && atMatch[2]) {
        return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
    }

    // 3. OpenStreetMap #map=zoom/lat/lng
    const osmMapRegex = /#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/i;
    const osmMapMatch = decodedUrl.match(osmMapRegex);
    if (osmMapMatch && osmMapMatch[1] && osmMapMatch[2]) {
        return { lat: parseFloat(osmMapMatch[1]), lng: parseFloat(osmMapMatch[2]) };
    }

    // 4. Check for query parameter q=lat,lng or query=lat,lng
    const qRegex = /[?&](?:q|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i;
    const qMatch = decodedUrl.match(qRegex);
    if (qMatch && qMatch[1] && qMatch[2]) {
        return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
    }

    // 5. Look for ll=lat,lng
    const llRegex = /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i;
    const llMatch = decodedUrl.match(llRegex);
    if (llMatch && llMatch[1] && llMatch[2]) {
        return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
    }

    // 6. Look for explicit latitude/longitude parameters (lat=..., lon=... or lat=..., lng=...)
    const latLonRegex = /[?&]lat(?:itude)?=(-?\d+(?:\.\d+)?)[&]lo?n(?:gitude)?=(-?\d+(?:\.\d+)?)/i;
    const latLonMatch = decodedUrl.match(latLonRegex);
    if (latLonMatch && latLonMatch[1] && latLonMatch[2]) {
        return { lat: parseFloat(latLonMatch[1]), lng: parseFloat(latLonMatch[2]) };
    }

    // Inverse parameters (lon=..., lat=...)
    const lonLatRegex = /[?&]lo?n(?:gitude)?=(-?\d+(?:\.\d+)?)[&]lat(?:itude)?=(-?\d+(?:\.\d+)?)/i;
    const lonLatMatch = decodedUrl.match(lonLatRegex);
    if (lonLatMatch && lonLatMatch[1] && lonLatMatch[2]) {
        return { lat: parseFloat(lonLatMatch[2]), lng: parseFloat(lonLatMatch[1]) };
    }

    // 7. Check for maps/place/lat,lng or maps/dir/[^/]*/lat,lng or search/lat,lng paths
    const placeRegex = /\/maps\/(?:place|dir|search|marker)\/(-?\d+\.\d+),(-?\d+\.\d+)/i;
    const placeMatch = decodedUrl.match(placeRegex);
    if (placeMatch && placeMatch[1] && placeMatch[2]) {
        return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };
    }

    // 8. Fallback search for any "lat,lng" matching numbers (South African bounds/world bounds)
    const fallbackRegex = /(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/;
    const fallbackMatch = decodedUrl.match(fallbackRegex);
    if (fallbackMatch && fallbackMatch[1] && fallbackMatch[2]) {
        const lat = parseFloat(fallbackMatch[1]);
        const lng = parseFloat(fallbackMatch[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { lat, lng };
        }
    }

    return null;
};

const extractCoordsFromHtml = (html: string): { lat: number; lng: number } | null => {
    // 1. Try static map URLs contained in standard image elements or social meta tags (e.g., center=-26.248,27.755)
    const staticMapUrlRegex = /staticmap\?center=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i;
    const staticMapMatch = html.match(staticMapUrlRegex);
    if (staticMapMatch && staticMapMatch[1] && staticMapMatch[2]) {
        return { lat: parseFloat(staticMapMatch[1]), lng: parseFloat(staticMapMatch[2]) };
    }

    // 2. Try looking for og:url content with @lat,lng or maps/place/lat,lng
    const ogUrlRegex = /<meta\s+property=["']og:url["']\s+content=["']([^"']*?@(-?\d+\.\d+),(-?\d+\.\d+)[^"']*?)["']/i;
    const ogUrlMatch = html.match(ogUrlRegex);
    if (ogUrlMatch && ogUrlMatch[2] && ogUrlMatch[3]) {
        return { lat: parseFloat(ogUrlMatch[2]), lng: parseFloat(ogUrlMatch[3]) };
    }

    // 3. Try searching for !3dlat!4dlng in the document
    const bangRegex = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/i;
    const bangMatch = html.match(bangRegex);
    if (bangMatch && bangMatch[1] && bangMatch[2]) {
        return { lat: parseFloat(bangMatch[1]), lng: parseFloat(bangMatch[2]) };
    }

    // 4. Any raw @lat,lng pattern found anywhere in the html
    const atRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const atMatch = html.match(atRegex);
    if (atMatch && atMatch[1] && atMatch[2]) {
        return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
    }

    // 5. Look for og:image or twitter:image which usually points to a staticmap
    const metaImageRegex = /<meta\s+(?:property|name)=["'](?:og|twitter):image["']\s+content=["']([^"']*?center=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)[^"']*?)["']/i;
    const metaImageMatch = html.match(metaImageRegex);
    if (metaImageMatch && metaImageMatch[2] && metaImageMatch[3]) {
        return { lat: parseFloat(metaImageMatch[2]), lng: parseFloat(metaImageMatch[3]) };
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
        let coords = extractCoordsFromUrl(url);
        let finalUrl = url;
        let responseBody = '';

        if (!coords) {
            // It doesn't have coordinates directly in its parameter list, follow redirects and check
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 8000);
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5'
                    },
                    signal: controller.signal
                });
                clearTimeout(id);
                finalUrl = response.url;

                // Handle cookie consent redirect pattern
                if (finalUrl.includes('consent.google.com')) {
                    const parsedUrl = new URL(finalUrl);
                    const continueUrl = parsedUrl.searchParams.get('continue');
                    if (continueUrl) {
                        finalUrl = decodeURIComponent(continueUrl);
                        // Fetch the actual maps/place destination URL to follow the consent cookie gap
                        const innerController = new AbortController();
                        const innerId = setTimeout(() => innerController.abort(), 6000);
                        try {
                            const innerRes = await fetch(finalUrl, {
                                method: 'GET',
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                    'Accept-Language': 'en-US,en;q=0.5'
                                },
                                signal: innerController.signal
                            });
                            clearTimeout(innerId);
                            finalUrl = innerRes.url;
                            if (innerRes.ok) {
                                responseBody = await innerRes.text();
                            }
                        } catch (innerErr) {
                            clearTimeout(innerId);
                            console.error('Failed to fetch continue URL after consent page:', innerErr);
                        }
                    }
                } else if (response.ok) {
                    responseBody = await response.text();
                }
            } catch (fetchErr) {
                clearTimeout(id);
                console.error('Failed to follow shortened URL redirect:', fetchErr);
            }

            // Extract from final redirected URL
            coords = extractCoordsFromUrl(finalUrl);

            // If still no coords, scrape responseBody HTML
            if (!coords && responseBody) {
                coords = extractCoordsFromHtml(responseBody);
            }
        }

        let address = '';

        // Extract place name as ultimate fallback via Nominatim search
        if (!coords) {
            const placeNameRegex = /\/maps\/place\/([^/?#]+)/i;
            const placeMatch = finalUrl.match(placeNameRegex);
            if (placeMatch && placeMatch[1]) {
                const queryText = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
                try {
                    const searchResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryText)}&format=json&polygon_geojson=1&countrycodes=za&accept-language=en&limit=1`, {
                        headers: {
                            'User-Agent': 'Rapid-IReport-App/1.0 (mzwelisto@gmail.com)'
                        }
                    });
                    if (searchResponse.ok) {
                        const searchData = await searchResponse.json();
                        if (searchData && searchData.length > 0) {
                            coords = {
                                lat: parseFloat(searchData[0].lat),
                                lng: parseFloat(searchData[0].lon)
                            };
                            address = searchData[0].display_name || '';
                        }
                    }
                } catch (searchErr) {
                    console.error('Nominatim search fallback failed:', searchErr);
                }
            }
        }

        if (!coords) {
            return res.status(422).json({ error: 'Could not extract coordinates from the maps link.' });
        }

        // Reverse geocode server-side using Nominatim if not already populated from fallback search
        if (!address) {
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
