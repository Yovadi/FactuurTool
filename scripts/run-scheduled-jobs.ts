import { checkAndRunScheduledJobs, SERVER_SKIP_JOB_TYPES } from '../src/utils/scheduledJobs.ts';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY zijn verplicht.');
  process.exit(1);
}

const ran = await checkAndRunScheduledJobs({ skip: SERVER_SKIP_JOB_TYPES });
console.log(ran.length === 0 ? 'Geen taken uitgevoerd.' : `Uitgevoerd: ${ran.join(', ')}`);
