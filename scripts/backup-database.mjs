#!/usr/bin/env node
/**
 * Read-only backup of the live Supabase project.
 *
 * Does not change any data. Writes JSON files under backups/<timestamp>/
 * (gitignored). Use this before claiming or disconnecting Bolt.
 *
 * Usage:
 *   node scripts/backup-database.mjs --dry-run
 *   node scripts/backup-database.mjs
 *
 * Env:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY (preferred)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLES, CURRENT_PROJECT_URL } from './db-tables.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

loadEnv(path.join(ROOT, '.env'));

const dryRun = process.argv.includes('--dry-run');
const supabaseUrl = (process.env.VITE_SUPABASE_URL || CURRENT_PROJECT_URL).replace(/\/$/, '');
const apiKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!apiKey) {
  console.error('Missing API key. Set SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const headers = {
  apikey: apiKey,
  Authorization: `Bearer ${apiKey}`,
  Prefer: 'count=exact',
};

const PAGE_SIZE = 1000;

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function countTable(table) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, { headers });
  if (res.status === 404) return { ok: false, status: 404, count: 0 };
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, count: 0, error: text.slice(0, 200) };
  }
  const range = res.headers.get('content-range') || '';
  const totalPart = range.includes('/') ? range.split('/')[1] : '0';
  const count = totalPart === '*' ? 0 : Number.parseInt(totalPart, 10) || 0;
  return { ok: true, status: res.status, count };
}

async function fetchAllRows(table) {
  const rows = [];
  let from = 0;
  while (true) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/${table}?select=*&order=id&offset=${from}&limit=${PAGE_SIZE}`,
      { headers }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${table}: HTTP ${res.status} ${text.slice(0, 300)}`);
    }
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function main() {
  console.log(`Supabase: ${supabaseUrl}`);
  console.log(dryRun ? 'Mode: dry-run (counts only, no files written)\n' : 'Mode: full backup\n');

  const manifest = {
    sourceUrl: supabaseUrl,
    createdAt: new Date().toISOString(),
    dryRun,
    usedServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    tables: {},
  };

  let failed = 0;
  for (const table of TABLES) {
    const info = await countTable(table);
    if (!info.ok) {
      failed += 1;
      manifest.tables[table] = info;
      console.log(`  FAIL  ${table.padEnd(32)} HTTP ${info.status}${info.error ? ` ${info.error}` : ''}`);
      continue;
    }
    manifest.tables[table] = { ok: true, count: info.count };
    console.log(`  OK    ${table.padEnd(32)} ${info.count} rows`);
  }

  if (dryRun) {
    const total = Object.values(manifest.tables).reduce((sum, t) => sum + (t.count || 0), 0);
    console.log(`\nDry-run complete. ${TABLES.length - failed}/${TABLES.length} tables reachable, ${total} rows.`);
    if (failed > 0) process.exit(1);
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(ROOT, 'backups', stamp);
  fs.mkdirSync(outDir, { recursive: true });

  for (const table of TABLES) {
    if (!manifest.tables[table]?.ok) continue;
    const rows = await fetchAllRows(table);
    fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
    manifest.tables[table].exported = rows.length;
    console.log(`  wrote ${table}.json (${rows.length})`);
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nBackup written to ${outDir}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
