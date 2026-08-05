import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowUrl = new URL('../.github/workflows/live-uat.yml', import.meta.url);
const fixtures = {
  base: new URL('../tests/uat/healthcheck-base.yaml', import.meta.url),
  apply: new URL('../tests/uat/healthcheck-apply.json', import.meta.url),
  update: new URL('../tests/uat/nested/healthcheck-update.yaml', import.meta.url),
};

test('live UAT is manual, protected, immutable, and cleanup-safe', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');

  assert.match(workflow, /^\s*workflow_dispatch:/mu);
  assert.match(workflow, /type:\s*choice[\s\S]*options:[\s\S]*- full[\s\S]*- cleanup-only/u);
  assert.doesNotMatch(workflow, /^\s+(?:pull_request|push|schedule):/mu);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s*read/u);
  assert.match(workflow, /cancel-in-progress:\s*false/u);
  assert.match(workflow, /environment:\s*se-uat/u);
  assert.match(workflow, /github\.ref\s*==\s*'refs\/heads\/main'/u);
  assert.match(workflow, /uses:\s*f5-sales-demo\/xcsh-action@97ff16f0ce33db6535a16cfe008b71980580ed38/u);
  assert.doesNotMatch(workflow, /f5-sales-demo\/xcsh-action@(?!97ff16f0ce33db6535a16cfe008b71980580ed38)/u);
  assert.doesNotMatch(workflow, /actions\/upload-artifact/u);
  assert.doesNotMatch(workflow, /XCSH_(?:USERNAME|CONSOLE_PASSWORD)/u);
  assert.doesNotMatch(workflow, /^\s+all:\s*true\s*$/mu);
  assert.match(workflow, /^\s+UAT_KIND:\s*healthcheck\s*$/mu);
  assert.doesNotMatch(workflow, /(?:UAT_KIND|resource-kind):\s*namespace/u);
  assert.doesNotMatch(workflow, /delete\s+["']?namespace/u);
  assert.match(workflow, /if:\s*always\(\)/u);
  assert.match(workflow, /SAFE_TO_CLEANUP/u);
  assert.match(workflow, /inputs\.mode\s*==\s*'cleanup-only'/u);

  for (const operation of ['validate', 'create', 'get', 'apply', 'diff', 'update', 'export', 'delete']) {
    assert.match(workflow, new RegExp(`operation:\\s*${operation}`, 'u'), `missing ${operation} operation`);
  }

  for (const actionInput of [
    'files',
    'manifest',
    'recursive',
    'namespace',
    'dry-run',
    'output',
    'result-file',
    'export-file',
    'resource-kind',
    'resource-name',
    'working-directory',
    'xcsh-version',
    'api-url',
    'api-token',
    'github-token',
  ]) {
    assert.match(workflow, new RegExp(`${actionInput}:`, 'u'), `missing ${actionInput} input coverage`);
  }

  for (const assertion of ['created', 'updated', 'unchanged', 'identical', 'different', 'deleted', 'dry-run']) {
    assert.match(workflow, new RegExp(`outputs\\.${assertion}`, 'u'), `missing ${assertion} output assertion`);
  }
});

test('healthcheck fixtures cover YAML, JSON, recursion, and deterministic changes', async () => {
  const [base, apply, update] = await Promise.all([
    readFile(fixtures.base, 'utf8'),
    readFile(fixtures.apply, 'utf8'),
    readFile(fixtures.update, 'utf8'),
  ]);

  for (const fixture of [base, apply, update]) {
    assert.match(fixture, /xcsh-action-uat-healthcheck/u);
    assert.doesNotMatch(fixture, /namespace\s*[:"]/u);
  }
  assert.match(base, /timeout:\s*3/u);
  assert.equal(JSON.parse(apply).spec.timeout, 5);
  assert.match(update, /timeout:\s*7/u);
});
