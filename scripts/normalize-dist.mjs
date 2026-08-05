import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const generatedFiles = ['index.js', 'NOTICE', 'package.json'];
const bundledAttributionEmail = / <einaros@gmail\.com>/gu;

for (const file of generatedFiles) {
  const filePath = path.resolve(import.meta.dirname, '..', 'dist', file);
  const contents = await readFile(filePath, 'utf8');
  const sanitized = file === 'index.js' ? contents.replace(bundledAttributionEmail, '') : contents;
  await writeFile(filePath, `${sanitized.replace(/\n*$/u, '')}\n`, 'utf8');
}
