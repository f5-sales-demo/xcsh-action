import { chmod, copyFile, lstat, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as core from '@actions/core';
import * as toolCache from '@actions/tool-cache';
import { verifyFileSha256 } from './digest.js';
import type { ResolvedAsset } from './types.js';

export interface InstalledXcsh {
  path: string;
  version: string;
  cacheHit: boolean;
}

export async function installXcsh(asset: ResolvedAsset): Promise<InstalledXcsh> {
  const cacheVersion = asset.version.replace(/^v/u, '');
  const executableName = asset.platformKey.startsWith('win32-') ? 'xcsh.exe' : 'xcsh';
  const cachedDirectory = toolCache.find('xcsh', cacheVersion, asset.platformKey);
  if (cachedDirectory) {
    const cachedPath = path.join(cachedDirectory, executableName);
    await verifyRegularExecutable(cachedPath, asset.binarySha256, asset.platformKey);
    core.info(`Using verified xcsh ${asset.version} from the runner tool cache`);
    return { path: cachedPath, version: asset.version, cacheHit: true };
  }

  const temporaryDirectory = await mkdtemp(path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'xcsh-install-'));
  try {
    const archivePath = path.join(temporaryDirectory, asset.archiveName);
    core.info(`Downloading xcsh ${asset.version} (${asset.platformKey})`);
    await toolCache.downloadTool(asset.downloadUrl, archivePath);
    await verifyFileSha256(archivePath, asset.archiveSha256);

    const releasedBinary = await extractReleasedBinary(archivePath, temporaryDirectory, asset);
    await verifyRegularExecutable(releasedBinary, asset.binarySha256, asset.platformKey);

    const stagingDirectory = path.join(temporaryDirectory, 'staging');
    await mkdir(stagingDirectory);
    const stagedExecutable = path.join(stagingDirectory, executableName);
    await copyFile(releasedBinary, stagedExecutable);
    if (!asset.platformKey.startsWith('win32-')) await chmod(stagedExecutable, 0o755);
    await verifyRegularExecutable(stagedExecutable, asset.binarySha256, asset.platformKey);

    const cacheDirectory = await toolCache.cacheDir(stagingDirectory, 'xcsh', cacheVersion, asset.platformKey);
    const installedPath = path.join(cacheDirectory, executableName);
    await verifyRegularExecutable(installedPath, asset.binarySha256, asset.platformKey);
    return { path: installedPath, version: asset.version, cacheHit: false };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function extractReleasedBinary(
  archivePath: string,
  temporaryDirectory: string,
  asset: ResolvedAsset,
): Promise<string> {
  if (asset.archiveKind === 'executable') return archivePath;
  const extractionDirectory = path.join(temporaryDirectory, 'extracted');
  const extractedRoot =
    asset.archiveKind === 'zip'
      ? await toolCache.extractZip(archivePath, extractionDirectory)
      : await toolCache.extractTar(archivePath, extractionDirectory);
  const matches = await findFilesNamed(extractedRoot, asset.archiveEntryName);
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one ${asset.archiveEntryName} in ${asset.archiveName}, found ${matches.length.toString()}`,
    );
  }
  return matches[0] as string;
}

async function findFilesNamed(directory: string, expectedName: string): Promise<string[]> {
  const matches: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findFilesNamed(candidate, expectedName)));
    } else if (entry.isFile() && entry.name === expectedName) {
      matches.push(candidate);
    } else if (entry.isSymbolicLink() && entry.name === expectedName) {
      throw new Error(`Refusing symbolic-link executable ${candidate}`);
    }
  }
  return matches;
}

async function verifyRegularExecutable(filePath: string, expectedDigest: string, platform: string): Promise<void> {
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Refusing non-regular xcsh executable: ${filePath}`);
  }
  await verifyFileSha256(filePath, expectedDigest);
  if (!platform.startsWith('win32-') && (metadata.mode & 0o111) === 0) {
    await chmod(filePath, metadata.mode | 0o755);
  }
}
