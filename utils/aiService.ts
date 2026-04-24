
import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface RecoveryInsight {
    vehicleType: string;
    likelyRecoveryArea: string;
    confidence: string;
    reasoning: string;
    hotspots: { lat: number; lng: number; description: string }[];
}

export const getRecoveryInsights = async (recoveredReports: any[]): Promise<RecoveryInsight[]> => {
    if (recoveredReports.length === 0) return [];

    const reportData = recoveredReports.map(r => ({
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

    try {
        const response = await client.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return [];
    } catch (error) {
        console.error("AI Insights Error:", error);
        return [];
    }
};
