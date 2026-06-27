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

const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2)
        ; 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
};

const getWordOverlap = (str1: string, str2: string): number => {
    const words1 = new Set(str1.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const words2 = new Set(str2.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    if (words1.size === 0) return 0;
    let matches = 0;
    for (const w of words1) {
        if (words2.has(w)) matches++;
    }
    return matches / words1.size;
};

const extractPlaceNameFromUrl = (url: string): string | null => {
    let decodedUrl = url;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch (e) {
        console.warn("Failed to decode URL in extractPlaceNameFromUrl:", e);
    }

    // 1. Match /maps/place/([^/?#]+)
    const placeRegex = /\/maps\/place\/([^/?#\s]+)/i;
    const placeMatch = decodedUrl.match(placeRegex);
    if (placeMatch && placeMatch[1]) {
        const value = placeMatch[1].replace(/\+/g, ' ').trim();
        // Ensure it's not just a pair of coordinates like "-25.123,28.456"
        const coordRegex = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;
        if (!coordRegex.test(value)) {
            return value;
        }
    }

    // 2. Match /maps/search/([^/?#]+)
    const searchPathRegex = /\/maps\/search\/([^/?#\s]+)/i;
    const searchPathMatch = decodedUrl.match(searchPathRegex);
    if (searchPathMatch && searchPathMatch[1]) {
        const value = searchPathMatch[1].replace(/\+/g, ' ').trim();
        const coordRegex = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;
        if (!coordRegex.test(value)) {
            return value;
        }
    }

    // 3. Match q=... query parameter
    try {
        const urlObj = new URL(url);
        const q = urlObj.searchParams.get('q') || urlObj.searchParams.get('query');
        if (q) {
            const value = q.replace(/\+/g, ' ').trim();
            const coordRegex = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;
            if (!coordRegex.test(value)) {
                return value;
            }
        }
    } catch (e) {
        // Fallback parameter matching if URL parsing fails
        const qParamRegex = /[?&](?:q|query)=([^&#\s]+)/i;
        const qParamMatch = decodedUrl.match(qParamRegex);
        if (qParamMatch && qParamMatch[1]) {
            const value = qParamMatch[1].replace(/\+/g, ' ').trim();
            const coordRegex = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;
            if (!coordRegex.test(value)) {
                return value;
            }
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
        let coords = extractCoordsFromUrl(url);
        let finalUrl = url;
        let responseBody = '';

        const isShortened = url.includes('goo.gl') || url.includes('maps.app.goo.gl') || url.includes('t.co') || url.includes('bit.ly') || url.includes('tinyurl');

        if (!coords || isShortened) {
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

        // Extract place name
        let placeName = extractPlaceNameFromUrl(finalUrl);
        if (!placeName && url !== finalUrl) {
            placeName = extractPlaceNameFromUrl(url);
        }

        let address = '';

        // Extract place name as ultimate fallback via Nominatim search if coords are missing
        if (!coords && placeName) {
            try {
                const searchResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&polygon_geojson=1&countrycodes=za&accept-language=en&limit=1`, {
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

        if (!coords) {
            return res.status(422).json({ error: 'Could not extract coordinates from the maps link.' });
        }

        // If we have a place name and coords, try Nominatim search first to resolve it to get accurate street/number/suburb structure
        if (placeName && !address) {
            try {
                const searchResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&countrycodes=za&accept-language=en&limit=1`, {
                    headers: {
                        'User-Agent': 'Rapid-IReport-App/1.0 (mzwelisto@gmail.com)'
                    }
                });
                if (searchResponse.ok) {
                    const searchData = await searchResponse.json();
                    if (searchData && searchData.length > 0) {
                        const searchLat = parseFloat(searchData[0].lat);
                        const searchLng = parseFloat(searchData[0].lon);
                        
                        // Check if the search result is close to the actual coordinates from the URL (within 1.5 km)
                        const dist = getDistanceInKm(coords.lat, coords.lng, searchLat, searchLng);
                        if (dist < 1.5) {
                            address = searchData[0].display_name || '';
                        }
                    }
                }
            } catch (searchErr) {
                console.error('Nominatim pre-search failed:', searchErr);
            }
        }

        // If we still don't have an address, do reverse geocoding on coordinates
        if (!address) {
            try {
                const reverseResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`, {
                    headers: {
                        'User-Agent': 'Rapid-IReport-App/1.0 (mzwelisto@gmail.com)'
                    }
                });
                if (reverseResponse.ok) {
                    const data = await reverseResponse.json();
                    const reverseAddress = data.display_name || '';
                    
                    if (placeName && reverseAddress) {
                        // Calculate word overlap between placeName and reverseAddress
                        const overlap = getWordOverlap(placeName, reverseAddress);
                        if (overlap > 0.4) {
                            // If they are very similar, use the clean placeName from Google Maps
                            address = placeName;
                        } else {
                            // If they are different (e.g., placeName is a venue/business name like "KFC Hatfield"
                            // and reverseAddress is "Burnett St, Hatfield..."), merge them elegantly!
                            address = `${placeName}, ${reverseAddress}`;
                        }
                    } else {
                        address = reverseAddress || placeName || '';
                    }
                }
            } catch (reverseErr) {
                console.error('Nominatim reverse geocode failed on server:', reverseErr);
            }
        }

        // Ultimate fallback
        if (!address && placeName) {
            address = placeName;
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
