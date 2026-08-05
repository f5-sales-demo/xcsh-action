import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeSha256 } from './digest.js';
import type { ArchiveKind, LockedAsset, ResolvedAsset, XcshLock } from './types.js';

const REPOSITORY = 'f5-sales-demo/xcsh';
const VERSION_PATTERN = /^v?\d+\.\d+\.\d+$/u;

interface GithubReleaseAsset {
  name?: unknown;
  digest?: unknown;
}

interface GithubRelease {
  tag_name?: unknown;
  draft?: unknown;
  immutable?: unknown;
  assets?: unknown;
}

export function platformKey(platform: NodeJS.Platform, architecture: string): string {
  const key = `${platform}-${architecture}`;
  const supported = new Set(['linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64', 'win32-x64']);
  if (!supported.has(key)) {
    throw new Error(`Unsupported runner platform: ${key}`);
  }
  return key;
}

export function normalizeVersion(value: string, lockedVersion: string): string {
  const requested = value.trim();
  if (requested === '' || requested === 'locked') return lockedVersion;
  if (!VERSION_PATTERN.test(requested)) {
    throw new Error("xcsh-version must be 'locked' or an exact semantic version such as v20.4.0");
  }
  return requested.startsWith('v') ? requested : `v${requested}`;
}

export async function loadLock(
  lockPath = path.resolve(import.meta.dirname, '..', 'xcsh.lock.json'),
): Promise<XcshLock> {
  const raw = JSON.parse(await readFile(lockPath, 'utf8')) as unknown;
  if (!isRecord(raw) || raw.schemaVersion !== 1 || raw.repository !== REPOSITORY || typeof raw.version !== 'string') {
    throw new Error('xcsh.lock.json has an unsupported schema');
  }
  if (!VERSION_PATTERN.test(raw.version) || !isRecord(raw.platforms)) {
    throw new Error('xcsh.lock.json contains an invalid version or platform map');
  }
  for (const [key, value] of Object.entries(raw.platforms)) validateLockedAsset(key, value);
  return raw as unknown as XcshLock;
}

export async function resolveAsset(options: {
  versionInput: string;
  platform: NodeJS.Platform;
  architecture: string;
  githubToken?: string;
  lock?: XcshLock;
}): Promise<ResolvedAsset> {
  const lock = options.lock ?? (await loadLock());
  const key = platformKey(options.platform, options.architecture);
  const version = normalizeVersion(options.versionInput, lock.version);
  const expectedNames = assetNames(key);

  let asset: LockedAsset;
  if (version === lock.version) {
    const locked = lock.platforms[key];
    if (!locked) throw new Error(`The xcsh lock does not contain ${key}`);
    asset = locked;
  } else {
    asset = await resolveReleaseAsset(version, expectedNames, options.githubToken);
  }

  if (
    asset.archiveName !== expectedNames.archiveName ||
    asset.archiveEntryName !== expectedNames.archiveEntryName ||
    asset.binaryName !== expectedNames.binaryName
  ) {
    throw new Error(`The xcsh asset mapping for ${key} is invalid`);
  }

  return {
    ...asset,
    platformKey: key,
    version,
    downloadUrl: releaseDownloadUrl(version, asset.archiveName),
  };
}

function assetNames(key: string): {
  archiveName: string;
  archiveEntryName: string;
  binaryName: string;
  archiveKind: ArchiveKind;
} {
  switch (key) {
    case 'linux-x64':
    case 'linux-arm64': {
      const architecture = key.split('-')[1];
      return {
        archiveName: `xcsh-linux-${architecture}.tar.gz`,
        archiveEntryName: 'xcsh',
        binaryName: `xcsh-linux-${architecture}`,
        archiveKind: 'tar.gz',
      };
    }
    case 'darwin-x64':
    case 'darwin-arm64': {
      const architecture = key.split('-')[1];
      return {
        archiveName: `xcsh-darwin-${architecture}.zip`,
        archiveEntryName: 'xcsh',
        binaryName: `xcsh-darwin-${architecture}`,
        archiveKind: 'zip',
      };
    }
    case 'win32-x64':
      return {
        archiveName: 'xcsh-windows-x64.exe',
        archiveEntryName: 'xcsh-windows-x64.exe',
        binaryName: 'xcsh-windows-x64.exe',
        archiveKind: 'executable',
      };
    default:
      throw new Error(`Unsupported runner platform: ${key}`);
  }
}

async function resolveReleaseAsset(
  version: string,
  names: {
    archiveName: string;
    archiveEntryName: string;
    binaryName: string;
    archiveKind: ArchiveKind;
  },
  token?: string,
): Promise<LockedAsset> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'f5-sales-demo-xcsh-action',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/releases/tags/${encodeURIComponent(version)}`,
    {
      headers,
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Unable to resolve xcsh ${version}: GitHub API returned ${response.status}`);
  }
  const release = (await response.json()) as GithubRelease;
  if (
    release.tag_name !== version ||
    release.draft === true ||
    release.immutable !== true ||
    !Array.isArray(release.assets)
  ) {
    throw new Error(`GitHub returned invalid release metadata for xcsh ${version}`);
  }
  const assets = release.assets.filter(isRecord) as GithubReleaseAsset[];
  const archiveDigest = digestForAsset(assets, names.archiveName);
  const binaryDigest = digestForAsset(assets, names.binaryName);
  return {
    archiveName: names.archiveName,
    archiveSha256: archiveDigest,
    archiveEntryName: names.archiveEntryName,
    binaryName: names.binaryName,
    binarySha256: binaryDigest,
    archiveKind: names.archiveKind,
  };
}

function digestForAsset(assets: GithubReleaseAsset[], name: string): string {
  const matches = assets.filter((asset) => asset.name === name);
  if (matches.length !== 1 || typeof matches[0]?.digest !== 'string') {
    throw new Error(`xcsh release asset ${name} is missing a unique SHA-256 digest`);
  }
  return normalizeSha256(matches[0].digest);
}

function releaseDownloadUrl(version: string, assetName: string): string {
  return `https://github.com/${REPOSITORY}/releases/download/${encodeURIComponent(version)}/${encodeURIComponent(assetName)}`;
}

function validateLockedAsset(key: string, value: unknown): asserts value is LockedAsset {
  if (!isRecord(value)) throw new Error(`xcsh.lock.json has an invalid ${key} entry`);
  for (const field of [
    'archiveName',
    'archiveSha256',
    'archiveEntryName',
    'binaryName',
    'binarySha256',
    'archiveKind',
  ] as const) {
    if (typeof value[field] !== 'string') throw new Error(`xcsh.lock.json ${key}.${field} must be a string`);
  }
  normalizeSha256(value.archiveSha256 as string);
  normalizeSha256(value.binarySha256 as string);
  if (!new Set<unknown>(['tar.gz', 'zip', 'executable']).has(value.archiveKind)) {
    throw new Error(`xcsh.lock.json ${key}.archiveKind is invalid`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
