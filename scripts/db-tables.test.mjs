import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLES, CURRENT_PROJECT_REF } from './db-tables.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('backup table list has unique names', () => {
  assert.equal(new Set(TABLES).size, TABLES.length);
});

test('restore order puts parents before children', () => {
  const idx = (name) => TABLES.indexOf(name);
  assert.ok(idx('tenants') < idx('leases'));
  assert.ok(idx('leases') < idx('lease_spaces'));
  assert.ok(idx('office_spaces') < idx('lease_spaces'));
  assert.ok(idx('invoices') < idx('invoice_line_items'));
  assert.ok(idx('credit_notes') < idx('credit_note_line_items'));
  assert.ok(idx('purchase_invoices') < idx('purchase_invoice_line_items'));
});

test('restore refuses the live production project without --allow-production', () => {
  const result = spawnSync(
    process.execPath,
    [
      path.join(__dirname, 'restore-database.mjs'),
      '--backup',
      'backups/does-not-exist',
      '--target-url',
      `https://${CURRENT_PROJECT_REF}.supabase.co`,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, TARGET_SUPABASE_SERVICE_ROLE_KEY: 'test-key' },
    }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to restore into the live production project/);
});
