import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import TelegramBot from 'node-telegram-bot-api';

export default async function handler(req: Request, res: Response) {
    // Optional: add a secret check to ensure only Vercel CRON can call this
    // if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    //     return res.status(401).end('Unauthorized');
    // }

    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramGroupId = process.env.TELEGRAM_GROUP_ID;

    if (!telegramToken || !telegramGroupId) {
        return res.status(500).json({ error: 'Telegram configuration missing' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
        return res.status(500).json({ error: 'Supabase Service Key missing' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const bot = new TelegramBot(telegramToken, { polling: false });

    try {
        // We look for reports in the last 2 minutes to ensure we don't miss any 
        // given the 1-minute cron frequency.
        const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();

        const { data: vehicleReports, error } = await supabaseAdmin
            .from('vehicle_reports')
            .select('*')
            .gt('reported_at', twoMinutesAgo)
            .order('reported_at', { ascending: true });

        if (error) throw error;

        if (vehicleReports && vehicleReports.length > 0) {
            console.log(`Found ${vehicleReports.length} reports to notify.`);
            for (const report of vehicleReports) {
                // In a stateless function, we should ideally check if we've already sent this.
                // For simplicity, we assume the 2-minute window is safe or we could store sent IDs.
                const message = `🚨 *New ${report.is_wanted ? 'WANTED' : 'Reported'} Vehicle* 🚨\n\n` +
                    `*Plate:* ${report.license_plate}\n` +
                    `*Make/Model:* ${report.vehicle_make} ${report.vehicle_model}\n` +
                    `*Color:* ${report.vehicle_color}\n` +
                    `*Last Seen:* ${report.last_seen_location}\n` +
                    `*Description:* ${report.description}\n`;
                
                await bot.sendMessage(telegramGroupId, message, { parse_mode: 'Markdown' });
            }
        }

        return res.status(200).json({ success: true, count: vehicleReports?.length || 0 });
    } catch (e: any) {
        console.error('Cron Error:', e);
        return res.status(500).json({ error: e.message });
    }
}
