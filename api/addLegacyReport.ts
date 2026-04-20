import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const data = req.body;
        const formData = new URLSearchParams();
        
        // Map frontend fields to legacy form fields exactly as required by the scraper
        formData.append('add-vehicle_registration', data.vehicle_registration || '');
        formData.append('add-make', data.make || '');
        formData.append('add-model', data.model || '');
        formData.append('add-color', data.color || '');
        formData.append('add-reason', data.reason || '');
        formData.append('add-cos_name', data.cos_name || '');
        formData.append('add-cos_contact_number', data.cos_contact_number || '');
        formData.append('add-case_number', data.case_number || '');
        formData.append('add-station_reported_at', data.station_reported_at || '');
        formData.append('add-io_name', data.io_name || '');
        formData.append('add-io_contact', data.io_contact || '');
        formData.append('add-recovered', data.recovered || '');
        formData.append('add-tracker', data.tracker || '');
        formData.append('add-date_of_incident', data.date_of_incident || '');
        
        // This button name triggers the actual PHP INSERT on their end
        formData.append('submit-add', '');

        const legacyRes = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });

        if (!legacyRes.ok) {
           throw new Error(`Legacy system responded with status: ${legacyRes.status}`);
        }

        const html = await legacyRes.text();
        // optionally parse HTML here to verify it committed successfully

        res.status(200).json({ success: true, message: 'Added successfully to legacy database' });
    } catch (error: any) {
        console.error('legacyAdd API Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}
