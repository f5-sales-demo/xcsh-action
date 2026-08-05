import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import * as glob from '@actions/glob';

const GLOB_MAGIC = /[*?{[]/u;

export async function expandManifestFiles(entries: string[], workingDirectory: string): Promise<string[]> {
  const expanded: string[] = [];
  for (const entry of entries) {
    if (entry === '-') {
      throw new Error("files does not accept stdin ('-'); use the manifest input for inline JSON or YAML");
    }
    if (entry.startsWith('!')) {
      throw new Error('Negative glob patterns are not supported in files');
    }
    const absoluteEntry = path.resolve(workingDirectory, entry);
    if (!GLOB_MAGIC.test(entry)) {
      await access(absoluteEntry);
      expanded.push(absoluteEntry);
      continue;
    }
    const pattern = absoluteEntry.split(path.sep).join('/');
    const globber = await glob.create(pattern, {
      followSymbolicLinks: false,
      implicitDescendants: false,
    });
    const matches = await globber.glob();
    if (matches.length === 0) throw new Error(`Manifest glob did not match any paths: ${entry}`);
    for (const match of matches) {
      const metadata = await stat(match);
      if (metadata.isFile() || metadata.isDirectory()) expanded.push(path.resolve(match));
    }
  }
  return [...new Set(expanded)];
}
