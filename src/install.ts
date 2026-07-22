import { execFile } from 'node:child_process';
import { access, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as core from '@actions/core';
import * as toolCache from '@actions/tool-cache';

import { verifyDigest } from './integrity.js';
import type { Platform } from './platform.js';
import { type Release, selectAsset } from './release.js';

const execute = promisify(execFile);

/** Result of a successful Sprocket installation: the cache directory and full path to the executable. */
export interface Installation {
  /** Absolute path to the directory added to `PATH` (the cache entry root). */
  readonly directory: string;
  /** Absolute path to the Sprocket executable inside `directory`. */
  readonly executablePath: string;
}

/** Side-effecting collaborators required by {@link installRelease}, injectable for testing. */
export interface InstallDependencies {
  /** Looks up a previously cached tool directory; returns an empty string on cache miss. */
  find(tool: string, version: string, architecture: string): string;
  /** Downloads `url` and returns the local path of the downloaded file. */
  downloadTool(url: string): Promise<string>;
  /** Extracts a `.tar.gz` archive and returns the extraction directory. */
  extractTar(path: string): Promise<string>;
  /** Extracts a `.zip` archive and returns the extraction directory. */
  extractZip(path: string): Promise<string>;
  /** Persists a directory in the Actions tool cache and returns the cached directory path. */
  cacheDir(
    sourceDirectory: string,
    tool: string,
    version: string,
    architecture: string,
  ): Promise<string>;
  /** Verifies the integrity of the file at `path` against `digest`. */
  verifyDigest(
    path: string,
    digest: string | null,
    warning: (message: string) => void,
  ): Promise<void>;
  /** Runs the executable at `executablePath` with `--version` to confirm it is operable. */
  smokeCheck(executablePath: string): Promise<void>;
  /** Emits a non-fatal warning message via the Actions toolkit. */
  warning(message: string): void;
}

const defaultDependencies: InstallDependencies = {
  find: toolCache.find,
  downloadTool: toolCache.downloadTool,
  extractTar: toolCache.extractTar,
  extractZip: toolCache.extractZip,
  cacheDir: toolCache.cacheDir,
  verifyDigest,
  async smokeCheck(executablePath: string): Promise<void> {
    await execute(executablePath, ['--version']);
  },
  warning(message: string): void {
    core.warning(message);
  },
};

/**
 * Downloads, verifies, extracts, and caches the Sprocket release asset for
 * `platform`, then smoke-tests the executable.
 * Returns immediately from the tool cache when the version was previously installed.
 *
 * @throws For download, verification, extraction, caching, or smoke-test failures.
 */
export async function installRelease(
  release: Release,
  platform: Platform,
  dependencies: InstallDependencies = defaultDependencies,
): Promise<Installation> {
  const asset = selectAsset(release, platform);
  const cacheVersion = release.version.slice(1);
  const cachedDirectory = dependencies.find(
    'sprocket',
    cacheVersion,
    platform.target,
  );
  if (cachedDirectory !== '') {
    const executablePath = join(cachedDirectory, platform.executable);
    await withContext(`Cached Sprocket ${release.version} did not run`, () =>
      dependencies.smokeCheck(executablePath),
    );
    return { directory: cachedDirectory, executablePath };
  }

  const archive = await withContext(
    `Failed to download release asset ${asset.name}`,
    () => dependencies.downloadTool(asset.downloadUrl),
  );
  await withContext(`Failed to verify release asset ${asset.name}`, () =>
    dependencies.verifyDigest(archive, asset.digest, (msg) =>
      dependencies.warning(msg),
    ),
  );

  const extracted = await withContext(
    `Failed to extract release asset ${asset.name}`,
    () =>
      platform.extension === 'zip'
        ? dependencies.extractZip(archive)
        : dependencies.extractTar(archive),
  );
  const extractedExecutable = join(extracted, platform.executable);

  try {
    await access(extractedExecutable);
  } catch (error) {
    throw new Error(
      `Release asset ${asset.name} does not contain root-level executable ${platform.executable}.`,
      { cause: error },
    );
  }

  if (platform.os !== 'Windows') {
    await chmod(extractedExecutable, 0o755);
  }

  const directory = await withContext(
    `Failed to cache Sprocket ${release.version}`,
    () =>
      dependencies.cacheDir(
        extracted,
        'sprocket',
        cacheVersion,
        platform.target,
      ),
  );
  const executablePath = join(directory, platform.executable);
  await withContext(`Installed Sprocket ${release.version} did not run`, () =>
    dependencies.smokeCheck(executablePath),
  );
  return { directory, executablePath };
}

async function withContext<T>(
  message: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}: ${detail}`, { cause: error });
  }
}
