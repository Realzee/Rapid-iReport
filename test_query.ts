import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await supabase
    .from('report_updates')
    .select('*, profile:profiles(first_name, surname)')
    .limit(1);

  console.log('Result for profile:profiles:', error);
  
  const { data: data2, error: error2 } = await supabase
    .from('report_updates')
    .select('*, profiles(first_name, surname)')
    .limit(1);

  console.log('Result for profiles:', error2);
}

main();
