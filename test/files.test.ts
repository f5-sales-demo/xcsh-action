import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { expandManifestFiles } from '../src/files.js';

test('expands include globs, keeps directories, and removes duplicates', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xcsh-files-test-'));
  await mkdir(path.join(directory, 'manifests'));
  await writeFile(path.join(directory, 'manifests', 'a.yaml'), 'kind: example\n', 'utf8');
  await writeFile(path.join(directory, 'manifests', 'b.json'), '{}\n', 'utf8');
  assert.deepEqual(await expandManifestFiles(['manifests/*.yaml', 'manifests/a.yaml'], directory), [
    path.join(directory, 'manifests', 'a.yaml'),
  ]);
  assert.deepEqual(await expandManifestFiles(['manifests'], directory), [path.join(directory, 'manifests')]);
});

test('rejects stdin and unmatched globs', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xcsh-files-test-'));
  await assert.rejects(expandManifestFiles(['-'], directory), /manifest input/u);
  await assert.rejects(expandManifestFiles(['*.yaml'], directory), /did not match/u);
});
