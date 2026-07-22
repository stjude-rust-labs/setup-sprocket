import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { installRelease, type InstallDependencies } from '../src/install.js';
import { resolvePlatform } from '../src/platform.js';
import type { Release } from '../src/release.js';

interface MockedDeps {
  deps: InstallDependencies;
  find: ReturnType<typeof vi.fn>;
  downloadTool: ReturnType<typeof vi.fn>;
  extractTar: ReturnType<typeof vi.fn>;
  extractZip: ReturnType<typeof vi.fn>;
  cacheDir: ReturnType<typeof vi.fn>;
  verifyDigest: ReturnType<typeof vi.fn>;
  smokeCheck: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
}

async function dependencies(executable: string): Promise<MockedDeps> {
  const root = await mkdtemp(join(tmpdir(), 'setup-sprocket-install-'));
  const archive = join(root, 'archive');
  const extracted = join(root, 'extracted');
  const cached = join(root, 'cached');
  await writeFile(archive, 'archive');
  await mkdir(extracted);
  await writeFile(join(extracted, executable), 'binary');
  await mkdir(cached);

  const find = vi.fn().mockReturnValue('');
  const downloadTool = vi.fn().mockResolvedValue(archive);
  const extractTar = vi.fn().mockResolvedValue(extracted);
  const extractZip = vi.fn().mockResolvedValue(extracted);
  const cacheDir = vi.fn().mockResolvedValue(cached);
  const verifyDigest = vi.fn().mockResolvedValue(undefined);
  const smokeCheck = vi.fn().mockResolvedValue(undefined);
  const warning = vi.fn();

  return {
    find,
    downloadTool,
    extractTar,
    extractZip,
    cacheDir,
    verifyDigest,
    smokeCheck,
    warning,
    deps: {
      find,
      downloadTool,
      extractTar,
      extractZip,
      cacheDir,
      verifyDigest,
      smokeCheck,
      warning,
    },
  };
}

function release(name: string): Release {
  return {
    version: 'v0.27.0',
    assets: [
      {
        name,
        downloadUrl: 'https://example.invalid/sprocket',
        digest: 'sha256:abc123',
      },
    ],
  };
}

describe('installRelease', () => {
  it('downloads, verifies, extracts, caches, and checks a tar archive', async () => {
    const platform = resolvePlatform('Linux', 'X64');
    const { deps, extractTar, extractZip, verifyDigest, smokeCheck } =
      await dependencies(platform.executable);
    const result = await installRelease(
      release('sprocket-v0.27.0-x86_64-unknown-linux-gnu.tar.gz'),
      platform,
      deps,
    );

    expect(extractTar).toHaveBeenCalledOnce();
    expect(extractZip).not.toHaveBeenCalled();
    expect(verifyDigest).toHaveBeenCalled();
    expect(smokeCheck).toHaveBeenCalledWith(result.executablePath);
    expect(result.directory).toContain('cached');
  });

  it('uses zip extraction for Windows', async () => {
    const platform = resolvePlatform('Windows', 'X64');
    const { deps, extractZip, extractTar } = await dependencies(
      platform.executable,
    );
    await installRelease(
      release('sprocket-v0.27.0-x86_64-pc-windows-msvc.zip'),
      platform,
      deps,
    );
    expect(extractZip).toHaveBeenCalledOnce();
    expect(extractTar).not.toHaveBeenCalled();
  });

  it('reuses an exact cached installation without downloading', async () => {
    const platform = resolvePlatform('Linux', 'X64');
    const { deps, find, downloadTool, smokeCheck } = await dependencies(
      platform.executable,
    );
    find.mockReturnValue('/tool/cache/sprocket');
    const result = await installRelease(
      release('sprocket-v0.27.0-x86_64-unknown-linux-gnu.tar.gz'),
      platform,
      deps,
    );
    expect(downloadTool).not.toHaveBeenCalled();
    expect(result.executablePath).toBe('/tool/cache/sprocket/sprocket');
    expect(smokeCheck).toHaveBeenCalledWith('/tool/cache/sprocket/sprocket');
  });

  it('fails when the archive lacks the root-level executable', async () => {
    const platform = resolvePlatform('Linux', 'X64');
    const { deps } = await dependencies('different-file');
    await expect(
      installRelease(
        release('sprocket-v0.27.0-x86_64-unknown-linux-gnu.tar.gz'),
        platform,
        deps,
      ),
    ).rejects.toThrow(/does not contain root-level executable sprocket/i);
  });

  it('preserves access error as cause when root-level executable is absent', async () => {
    const platform = resolvePlatform('Linux', 'X64');
    const { deps } = await dependencies('different-file');
    const rejection = await installRelease(
      release('sprocket-v0.27.0-x86_64-unknown-linux-gnu.tar.gz'),
      platform,
      deps,
    ).catch((e: unknown) => e);
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).cause).toBeInstanceOf(Error);
  });

  it('wraps digest verification errors with the asset name', async () => {
    const platform = resolvePlatform('Linux', 'X64');
    const { deps, verifyDigest } = await dependencies(platform.executable);
    verifyDigest.mockRejectedValue(new Error('checksum mismatch'));
    const rejection = await installRelease(
      release('sprocket-v0.27.0-x86_64-unknown-linux-gnu.tar.gz'),
      platform,
      deps,
    ).catch((e: unknown) => e);
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toMatch(
      /sprocket-v0\.27\.0-x86_64-unknown-linux-gnu\.tar\.gz/,
    );
    expect((rejection as Error).cause).toBeInstanceOf(Error);
  });
});
