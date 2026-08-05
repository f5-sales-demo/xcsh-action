import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('uses the unique GitHub Marketplace name', async () => {
  const metadata = await readFile(new URL('../action.yml', import.meta.url), 'utf8');
  assert.match(metadata, /^name: xcsh Manifest Automation$/mu);
});
