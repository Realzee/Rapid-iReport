
// AI Analytics Service
export interface RecoveryInsight {
    vehicleType: string;
    likelyRecoveryArea: string;
    confidence: string;
    reasoning: string;
    hotspots: { lat: number; lng: number; description: string }[];
}

export const getRecoveryInsights = async (recoveredReports: any[]): Promise<RecoveryInsight[]> => {
    if (recoveredReports.length === 0) return [];

    try {
        const res = await fetch('/api/ai-insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reports: recoveredReports })
        });

        if (!res.ok) {
            throw new Error(`AI API responded with status: ${res.status}`);
        }

        return await res.json();
    } catch (error) {
        console.error("AI Service Error:", error);
        return [];
    }
};
