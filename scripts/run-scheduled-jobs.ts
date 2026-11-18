import { checkAndRunScheduledJobs, SERVER_SKIP_JOB_TYPES } from '../src/utils/scheduledJobs.ts';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY zijn verplicht.');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY ontbreekt. De uurtaak gebruikt nog de publieke sleutel.');
}

async function main(): Promise<void> {
  const ran = await checkAndRunScheduledJobs({ skip: SERVER_SKIP_JOB_TYPES, strict: true });
  console.log(ran.length === 0 ? 'Geen taken uitgevoerd.' : `Uitgevoerd: ${ran.join(', ')}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
