import assert from 'node:assert/strict';
import { access, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runExecutable } from '../src/process.js';

test('spawns arguments directly without shell evaluation', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xcsh-process-test-'));
  const helper = path.join(directory, 'helper.mjs');
  const marker = path.join(directory, 'shell-was-evaluated');
  await writeFile(helper, 'process.exit(process.argv.length === 3 ? 0 : 9);\n', 'utf8');
  const result = await runExecutable(process.execPath, [helper, `$(touch ${marker})`], {
    cwd: directory,
    env: { ...process.env },
  });
  assert.equal(result.exitCode, 0);
  await assert.rejects(access(marker));
});
