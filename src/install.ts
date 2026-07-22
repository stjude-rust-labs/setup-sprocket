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

export interface Installation {
  readonly directory: string;
  readonly executablePath: string;
}

export interface InstallDependencies {
  find(tool: string, version: string, architecture: string): string;
  downloadTool(url: string): Promise<string>;
  extractTar(path: string): Promise<string>;
  extractZip(path: string): Promise<string>;
  cacheDir(
    sourceDirectory: string,
    tool: string,
    version: string,
    architecture: string,
  ): Promise<string>;
  verifyDigest(
    path: string,
    digest: string | null,
    warning: (message: string) => void,
  ): Promise<void>;
  smokeCheck(executablePath: string): Promise<void>;
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
  await dependencies.verifyDigest(archive, asset.digest, (msg) =>
    dependencies.warning(msg),
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
  } catch {
    throw new Error(
      `Release asset ${asset.name} does not contain root-level executable ${platform.executable}.`,
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
