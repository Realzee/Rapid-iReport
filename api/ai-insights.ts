import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: Request, res: Response) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { reports } = req.body;
    if (!reports || !Array.isArray(reports)) {
        return res.status(400).json({ error: 'Reports array is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(503).json({ error: 'AI service not configured' });
    }

    try {
        const ai = new GoogleGenAI({ 
            apiKey,
            httpOptions: {
                headers: {
                    'User-Agent': 'aistudio-build',
                }
            }
        });

        const reportData = reports.map(r => ({
            make: r.vehicle_make,
            model: r.vehicle_model,
            stolen_location: r.last_seen_location,
            stolen_coords: r.location_coords,
            recovered_coords: r.recovered_location_coords,
            recovered_at: r.recovered_at
        }));

        const prompt = `
            As a security AI analyst, analyze the following historical vehicle theft and recovery data.
            Identify patterns based on vehicle types (Make/Model) and where they are typically recovered compared to where they were stolen.
            
            Data: ${JSON.stringify(reportData)}
            
            Provide a list of insights including:
            1. Vehicle Type (e.g., Toyota Hilux)
            2. Likely Recovery Area (Description)
            3. Confidence level (Low/Medium/High)
            4. Reasoning based on the patterns found.
            5. Specific coordinate hotspots if many vehicles of same type end up in same vicinity.
            
            Return the result ONLY as a JSON array of objects with fields: vehicleType, likelyRecoveryArea, confidence, reasoning, hotspots (array of {lat, lng, description}).
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
        });

        const text = response.text || '';
        
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) {
            return res.status(200).json(JSON.parse(jsonMatch[0]));
        }
        
        try {
            return res.status(200).json(JSON.parse(text));
        } catch {
            return res.status(500).json({ error: 'Failed to parse AI response' });
        }
    } catch (error: any) {
        console.error("AI API Error:", error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}
