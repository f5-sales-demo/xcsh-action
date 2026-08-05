import assert from 'node:assert/strict';
import test from 'node:test';
import { count, parseReport, reportHasChanges } from '../src/report.js';

test('parses stable reports and identifies mutations and diffs', () => {
  const report = parseReport(
    JSON.stringify({
      schemaVersion: 1,
      operation: 'diff',
      success: true,
      counts: { total: 2, succeeded: 2, failed: 0, different: 1, identical: 1 },
      results: [
        { index: 0, status: 'different', diff: { hasDifferences: true } },
        { index: 1, status: 'identical', diff: { hasDifferences: false } },
      ],
    }),
    'diff',
  );
  assert.equal(reportHasChanges(report), true);
  assert.equal(count(report, 'different'), 1);
  assert.equal(count(report, 'deleted'), 0);
});

test('rejects incompatible and malformed reports', () => {
  assert.throws(() => parseReport('{}', 'apply'), /incompatible/u);
  assert.throws(
    () =>
      parseReport(
        JSON.stringify({
          schemaVersion: 1,
          operation: 'apply',
          success: true,
          counts: { total: -1, succeeded: 0, failed: 0 },
          results: [],
        }),
        'apply',
      ),
    /total is invalid/u,
  );
});
