import { execFile } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as core from '@actions/core';
import * as toolCache from '@actions/tool-cache';

import type { BranchRevision } from './branch.js';
import { REPOSITORY_URL } from './github.js';
import type { Platform } from './platform.js';

const executeFile = promisify(execFile);
const SOURCE_VERSION_PATTERN =
  /^sprocket\s+v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?=$|[\s+-])/;

/** A source installation and the package version reported by its executable. */
export interface SourceInstallation {
  /** Absolute path to the cache entry root directory. */
  readonly directory: string;
  /** Absolute path to the cached Sprocket executable. */
  readonly executablePath: string;
  /** The normalized package version reported by `sprocket --version`. */
  readonly version: string;
}

/** Side-effecting source installation collaborators. */
export interface SourceInstallDependencies {
  /** Looks up a previously cached tool directory; returns an empty string on cache miss. */
  find(tool: string, version: string, architecture: string): string;
  /** Persists a directory in the Actions tool cache and returns the cached directory path. */
  cacheDir(
    sourceDirectory: string,
    tool: string,
    version: string,
    architecture: string,
  ): Promise<string>;
  /** Creates an empty temporary Cargo install root. */
  makeTempDirectory(): Promise<string>;
  /** Removes a directory tree after installation succeeds or fails. */
  removeDirectory(path: string): Promise<void>;
  /** Verifies that a path exists. */
  access(path: string): Promise<void>;
  /** Runs a command and returns its standard output. */
  execute(file: string, arguments_: readonly string[]): Promise<string>;
  /** Logs a source-installation milestone. */
  info(message: string): void;
}

const defaultDependencies: SourceInstallDependencies = {
  find: toolCache.find,
  cacheDir: toolCache.cacheDir,
  makeTempDirectory: () => mkdtemp(join(tmpdir(), 'setup-sprocket-source-')),
  removeDirectory: (path) => rm(path, { recursive: true, force: true }),
  access,
  async execute(file, arguments_): Promise<string> {
    const result = await executeFile(file, arguments_);
    return result.stdout;
  },
  info: core.info,
};

/** Extracts and normalizes the package version from `sprocket --version`. */
export function parseSprocketVersion(output: string): string {
  const value = output.trim();
  const match = SOURCE_VERSION_PATTERN.exec(value);
  if (match === null) {
    throw new Error(
      `Could not determine the installed Sprocket version from ${JSON.stringify(value)}.`,
    );
  }

  const [, major, minor, patch] = match;
  if (major === undefined || minor === undefined || patch === undefined) {
    throw new Error(
      `Could not determine the installed Sprocket version from ${JSON.stringify(value)}.`,
    );
  }
  return `v${Number(major)}.${Number(minor)}.${Number(patch)}`;
}

/** Builds, caches, and smoke-tests an immutable Sprocket source revision. */
export async function installSource(
  revision: BranchRevision,
  platform: Platform,
  dependencies: SourceInstallDependencies = defaultDependencies,
): Promise<SourceInstallation> {
  const cacheVersion = `0.0.0-branch.${revision.commitSha}`;
  dependencies.info(
    `Checking cache for Sprocket branch \`${revision.name}\` at \`${revision.commitSha}\` for target \`${platform.target}\`.`,
  );
  let directory = dependencies.find('sprocket', cacheVersion, platform.target);

  if (directory === '') {
    dependencies.info(
      `No cached build found for commit \`${revision.commitSha}\`; building from source.`,
    );
    const root = await dependencies.makeTempDirectory();
    try {
      const sourceDirectory = join(root, 'source');
      dependencies.info(
        `Cloning \`${REPOSITORY_URL}\` into \`${sourceDirectory}\`.`,
      );
      await withContext('Failed to clone the Sprocket repository', () =>
        dependencies.execute('git', [
          'clone',
          '--filter=blob:none',
          '--no-checkout',
          REPOSITORY_URL,
          sourceDirectory,
        ]),
      );
      dependencies.info(`Checking out commit \`${revision.commitSha}\`.`);
      await withContext(
        `Failed to check out Sprocket branch ${revision.name} at ${revision.commitSha}`,
        () =>
          dependencies.execute('git', [
            '-C',
            sourceDirectory,
            'checkout',
            '--detach',
            revision.commitSha,
          ]),
      );
      dependencies.info(
        `Building Sprocket from \`${sourceDirectory}\` with \`cargo install --locked\`.`,
      );
      await withContext(
        `Failed to install Sprocket branch ${revision.name} at ${revision.commitSha}`,
        () =>
          dependencies.execute('cargo', [
            'install',
            '--path',
            sourceDirectory,
            '--locked',
            '--root',
            root,
            'sprocket',
          ]),
      );
      const binDirectory = join(root, 'bin');
      const installedExecutable = join(binDirectory, platform.executable);
      await withContext(
        `Cargo did not install ${platform.executable} for Sprocket branch ${revision.name}`,
        () => dependencies.access(installedExecutable),
      );
      dependencies.info(
        `Caching source build for commit \`${revision.commitSha}\`.`,
      );
      directory = await withContext(
        `Failed to cache Sprocket branch ${revision.name} at ${revision.commitSha}`,
        () =>
          dependencies.cacheDir(
            binDirectory,
            'sprocket',
            cacheVersion,
            platform.target,
          ),
      );
    } finally {
      await dependencies.removeDirectory(root);
    }
  } else {
    dependencies.info(
      `Using cached Sprocket branch \`${revision.name}\` from \`${directory}\`.`,
    );
  }

  const executablePath = join(directory, platform.executable);
  dependencies.info(`Verifying executable \`${executablePath}\`.`);
  const output = await withContext(
    `Installed Sprocket branch ${revision.name} at ${revision.commitSha} did not run`,
    () => dependencies.execute(executablePath, ['--version']),
  );
  const version = await withContext(
    `Installed Sprocket branch ${revision.name} at ${revision.commitSha} did not report a valid version`,
    () => parseSprocketVersion(output),
  );
  return {
    directory,
    executablePath,
    version,
  };
}

async function withContext<T>(
  message: string,
  operation: () => T | Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}: ${detail}`, { cause: error });
  }
}
