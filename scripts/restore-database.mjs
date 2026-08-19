#!/usr/bin/env node
/**
 * Restore a backup created by backup-database.mjs into a TARGET Supabase project.
 *
 * SAFETY: refuses to write to the current production project unless
 * --allow-production is passed. Never run this against production to "test".
 *
 * Usage:
 *   node scripts/restore-database.mjs --backup backups/<stamp> --target-url https://xxxx.supabase.co
 *
 * Env:
 *   TARGET_SUPABASE_URL (or --target-url)
 *   TARGET_SUPABASE_SERVICE_ROLE_KEY (required — anon cannot reliably upsert)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLES, CURRENT_PROJECT_REF } from './db-tables.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
loadEnv(path.join(ROOT, '.env'));

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

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx === process.argv.length - 1) return null;
  return process.argv[idx + 1];
}

const backupDir = argValue('--backup');
const targetUrl = (argValue('--target-url') || process.env.TARGET_SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const allowProduction = process.argv.includes('--allow-production');

if (!backupDir || !targetUrl || !serviceKey) {
  console.error(`Usage:
  TARGET_SUPABASE_SERVICE_ROLE_KEY=... node scripts/restore-database.mjs \\
    --backup backups/<timestamp> \\
    --target-url https://YOUR-NEW-PROJECT.supabase.co

This copies data into a NEW project. Do not point --target-url at production.`);
  process.exit(1);
}

if (targetUrl.includes(CURRENT_PROJECT_REF) && !allowProduction) {
  console.error(`Refusing to restore into the live production project (${CURRENT_PROJECT_REF}).`);
  console.error('Claiming the existing Bolt database is the safe way to keep this data.');
  console.error('Pass --allow-production only if you fully understand the risk.');
  process.exit(1);
}

const absBackup = path.resolve(ROOT, backupDir);
if (!fs.existsSync(absBackup)) {
  console.error(`Backup folder not found: ${absBackup}`);
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal',
};

async function upsertTable(table, rows) {
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const res = await fetch(`${targetUrl}/rest/v1/${table}?on_conflict=id`, {
      method: 'POST',
      headers,
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${table} offset ${i}: HTTP ${res.status} ${text.slice(0, 400)}`);
    }
  }
}

async function main() {
  console.log(`Restore ${absBackup}`);
  console.log(`Target  ${targetUrl}\n`);

  for (const table of TABLES) {
    const file = path.join(absBackup, `${table}.json`);
    if (!fs.existsSync(file)) {
      console.log(`  skip  ${table} (no file)`);
      continue;
    }
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log(`  skip  ${table} (empty)`);
      continue;
    }
    await upsertTable(table, rows);
    console.log(`  ok    ${table.padEnd(32)} ${rows.length} rows`);
  }

  console.log('\nRestore finished. Deploy edge functions to the new project next:');
  console.log('  npx supabase functions deploy --project-ref <new-ref>');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
