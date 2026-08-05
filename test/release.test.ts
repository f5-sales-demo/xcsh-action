import assert from 'node:assert/strict';
import test from 'node:test';
import { loadLock, normalizeVersion, platformKey, resolveAsset } from '../src/release.js';

test('maps every supported runner to a locked release asset', async () => {
  const lock = await loadLock();
  for (const [platform, architecture, expectedArchive] of [
    ['linux', 'x64', 'xcsh-linux-x64.tar.gz'],
    ['linux', 'arm64', 'xcsh-linux-arm64.tar.gz'],
    ['darwin', 'x64', 'xcsh-darwin-x64.zip'],
    ['darwin', 'arm64', 'xcsh-darwin-arm64.zip'],
    ['win32', 'x64', 'xcsh-windows-x64.exe'],
  ] as const) {
    const resolved = await resolveAsset({
      versionInput: 'locked',
      platform,
      architecture,
      lock,
    });
    assert.equal(resolved.archiveName, expectedArchive);
    assert.equal(resolved.version, lock.version);
    assert.match(resolved.downloadUrl, /^https:\/\/github\.com\/f5-sales-demo\/xcsh\/releases\/download\//u);
  }
});

test('requires a supported platform and exact version', () => {
  assert.equal(platformKey('linux', 'x64'), 'linux-x64');
  assert.throws(() => platformKey('win32', 'arm64'), /Unsupported runner platform/u);
  assert.equal(normalizeVersion('20.4.0', 'v20.3.3'), 'v20.4.0');
  assert.throws(() => normalizeVersion('latest', 'v20.3.3'), /exact semantic version/u);
});

test('resolves exact overrides only from immutable release digests', async () => {
  const lock = await loadLock();
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  try {
    globalThis.fetch = (async (input: string | URL | Request) => {
      requestedUrls.push(String(input));
      return new Response(
        JSON.stringify({
          tag_name: 'v21.0.0',
          draft: false,
          immutable: true,
          assets: [
            {
              name: 'xcsh-linux-x64.tar.gz',
              digest: `sha256:${'a'.repeat(64)}`,
            },
            { name: 'xcsh-linux-x64', digest: `sha256:${'b'.repeat(64)}` },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;
    const asset = await resolveAsset({
      versionInput: 'v21.0.0',
      platform: 'linux',
      architecture: 'x64',
      lock,
    });
    assert.equal(asset.archiveSha256, 'a'.repeat(64));
    assert.equal(asset.binarySha256, 'b'.repeat(64));
    assert.match(requestedUrls[0] as string, /releases\/tags\/v21\.0\.0$/u);

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          tag_name: 'v21.0.1',
          draft: false,
          immutable: false,
          assets: [],
        }),
        { status: 200 },
      )) as typeof fetch;
    await assert.rejects(
      resolveAsset({
        versionInput: 'v21.0.1',
        platform: 'linux',
        architecture: 'x64',
        lock,
      }),
      /invalid release metadata/u,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
