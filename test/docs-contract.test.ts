import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parse } from 'yaml';

interface ActionManifest {
  inputs: Record<string, { description: string }>;
  outputs: Record<string, { description: string }>;
}

const referencePath = new URL('../docs/en/reference/action.mdx', import.meta.url);
const manifestPath = new URL('../action.yml', import.meta.url);

function section(markdown: string, heading: string): string {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing ${marker} section`);
  const bodyStart = start + marker.length;
  const nextHeading = markdown.indexOf('\n## ', bodyStart);
  return markdown.slice(bodyStart, nextHeading === -1 ? undefined : nextHeading);
}

function tableIdentifiers(markdown: string, heading: string): string[] {
  const identifiers = [...section(markdown, heading).matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((match) => match[1]!);
  assert.equal(new Set(identifiers).size, identifiers.length, `${heading} contains duplicate identifiers`);
  return identifiers.sort();
}

function declaredOperations(description: string): string[] {
  const declaration = description.match(/:\s*(.+)$/)?.[1];
  assert.ok(declaration, 'operation description must declare its supported values after a colon');
  return declaration
    .replace(/, or /g, ', ')
    .split(', ')
    .map((operation) => operation.trim())
    .sort();
}

test('Action reference covers every declared operation, input, and output', async () => {
  const [manifestSource, reference] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(referencePath, 'utf8'),
  ]);
  const manifest = parse(manifestSource) as ActionManifest;
  const operationInput = manifest.inputs.operation;
  assert.ok(operationInput, 'action.yml must declare the operation input');

  assert.deepEqual(
    tableIdentifiers(reference, 'Operations'),
    declaredOperations(operationInput.description),
    'documented operations must exactly match action.yml',
  );
  assert.deepEqual(
    tableIdentifiers(reference, 'Inputs'),
    Object.keys(manifest.inputs).sort(),
    'documented inputs must exactly match action.yml',
  );
  assert.deepEqual(
    tableIdentifiers(reference, 'Outputs'),
    Object.keys(manifest.outputs).sort(),
    'documented outputs must exactly match action.yml',
  );
});
