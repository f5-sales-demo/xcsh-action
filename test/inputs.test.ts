import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { readActionInputs } from '../src/inputs.js';

test('reads Action defaults and preserves inline manifest data', () => {
  const environmentKeys = [
    'GITHUB_WORKSPACE',
    'INPUT_OPERATION',
    'INPUT_FILES',
    'INPUT_MANIFEST',
    'INPUT_RECURSIVE',
    'INPUT_DRY-RUN',
    'INPUT_OUTPUT',
    'INPUT_ALL',
    'INPUT_WORKING-DIRECTORY',
  ] as const;
  const original = new Map(environmentKeys.map((key) => [key, process.env[key]]));
  try {
    process.env.GITHUB_WORKSPACE = path.parse(process.cwd()).root;
    process.env.INPUT_OPERATION = 'export';
    process.env.INPUT_FILES = '';
    process.env.INPUT_MANIFEST = '  kind: example\n';
    process.env.INPUT_RECURSIVE = 'false';
    process.env['INPUT_DRY-RUN'] = 'none';
    process.env.INPUT_OUTPUT = 'auto';
    process.env.INPUT_ALL = 'true';
    process.env['INPUT_WORKING-DIRECTORY'] = 'workspace';

    const inputs = readActionInputs(process.env);
    assert.equal(inputs.operation, 'export');
    assert.equal(inputs.outputFormat, 'yaml');
    assert.equal(inputs.inlineManifest, '  kind: example\n');
    assert.equal(inputs.exportAll, true);
    assert.equal(inputs.workingDirectory, path.resolve(path.parse(process.cwd()).root, 'workspace'));
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
