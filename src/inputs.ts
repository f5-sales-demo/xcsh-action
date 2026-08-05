import path from 'node:path';
import * as core from '@actions/core';
import { type ActionInputs, OPERATIONS, type Operation, type OutputFormat } from './types.js';

export function readActionInputs(environment: NodeJS.ProcessEnv = process.env): ActionInputs {
  const operationValue = core.getInput('operation', { required: true }).toLowerCase();
  if (!OPERATIONS.includes(operationValue as Operation)) {
    throw new Error(`operation must be one of: ${OPERATIONS.join(', ')}`);
  }
  const operation = operationValue as Operation;
  const outputValue = core.getInput('output').toLowerCase() || 'auto';
  const outputFormat = normalizeOutput(outputValue, operation);
  const dryRunValue = core.getInput('dry-run').toLowerCase() || 'none';
  if (dryRunValue !== 'none' && dryRunValue !== 'client') {
    throw new Error("dry-run must be 'none' or 'client'");
  }

  const workspace = environment.GITHUB_WORKSPACE ?? process.cwd();
  const workingDirectoryValue = core.getInput('working-directory') || '.';
  const inputs: ActionInputs = {
    operation,
    fileEntries: core.getMultilineInput('files', { trimWhitespace: true }),
    recursive: core.getBooleanInput('recursive'),
    outputFormat,
    exportAll: core.getBooleanInput('all'),
    workingDirectory: path.resolve(workspace, workingDirectoryValue),
    version: core.getInput('xcsh-version') || 'locked',
  };

  assignIfPresent(inputs, 'inlineManifest', core.getInput('manifest', { trimWhitespace: false }));
  assignIfPresent(inputs, 'namespace', core.getInput('namespace'));
  assignIfPresent(inputs, 'resultFile', core.getInput('result-file'));
  assignIfPresent(inputs, 'exportFile', core.getInput('export-file'));
  assignIfPresent(inputs, 'resourceKind', core.getInput('resource-kind'));
  assignIfPresent(inputs, 'resourceName', core.getInput('resource-name'));
  assignIfPresent(inputs, 'githubToken', core.getInput('github-token'));
  assignIfPresent(inputs, 'apiUrl', core.getInput('api-url'));
  assignIfPresent(inputs, 'apiToken', core.getInput('api-token', { trimWhitespace: false }));
  if (dryRunValue === 'client') inputs.dryRun = 'client';
  return inputs;
}

function normalizeOutput(value: string, operation: Operation): OutputFormat {
  if (value === 'auto') return operation === 'export' ? 'yaml' : 'table';
  if (!new Set(['json', 'yaml', 'table', 'wide']).has(value)) {
    throw new Error('output must be auto, json, yaml, table, or wide');
  }
  if (operation === 'export' && value !== 'json' && value !== 'yaml') {
    throw new Error('export output must be json or yaml');
  }
  return value as OutputFormat;
}

function assignIfPresent<K extends keyof ActionInputs>(
  inputs: ActionInputs,
  key: K,
  value: ActionInputs[K] | '',
): void {
  if (value !== '') inputs[key] = value as ActionInputs[K];
}
