import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const generatedFiles = ['index.js', 'index.js.map', 'package.json', 'sourcemap-register.cjs'];

for (const file of generatedFiles) {
  const filePath = path.resolve(import.meta.dirname, '..', 'dist', file);
  const contents = await readFile(filePath, 'utf8');
  await writeFile(filePath, `${contents.replace(/\n*$/u, '')}\n`, 'utf8');
}
