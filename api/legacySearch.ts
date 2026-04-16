import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query } = req.body;
    if (!query) {
        return res.json({ data: [] });
    }

    try {
        const params = new URLSearchParams();
        params.append('search', query);
        params.append('submit-search', 'Search');

        const response = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php', {
            method: 'POST',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!response.ok) {
            throw new Error(`Legacy server responded with status: ${response.status}`);
        }

        const html = await response.text();
        const results: any[] = [];
        const regex = /data-entry='({.*?})'/g;
        let match;
        
        while ((match = regex.exec(html)) !== null) {
            try {
                const jsonStr = match[1].replace(/&quot;/g, '"');
                const parsed = JSON.parse(jsonStr);
                
                // Deduplicate items
                if (!results.find(r => r.id === parsed.id)) {
                    results.push(parsed);
                }
            } catch (e) {
                console.error("Failed to parse legacy JSON:", e);
            }
        }

        res.status(200).json({ data: results });
    } catch (error: any) {
        console.error('legacySearch API Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}
