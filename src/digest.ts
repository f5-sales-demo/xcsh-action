import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export function normalizeSha256(value: string): string {
  const normalized = value.toLowerCase().replace(/^sha256:/u, '');
  if (!SHA256_PATTERN.test(normalized)) {
    throw new Error(`Invalid SHA-256 digest: ${value}`);
  }
  return normalized;
}

export async function sha256File(filePath: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    digest.update(chunk as Buffer);
  }
  return digest.digest('hex');
}

export async function verifyFileSha256(filePath: string, expected: string): Promise<void> {
  const normalizedExpected = normalizeSha256(expected);
  const actual = await sha256File(filePath);
  if (actual !== normalizedExpected) {
    throw new Error(`SHA-256 mismatch for ${filePath}: expected ${normalizedExpected}, received ${actual}`);
  }
}
