import * as core from '@actions/core';

import { installRelease, type Installation } from './install.js';
import { resolvePlatform, type Platform } from './platform.js';
import {
  createReleaseApi,
  type Release,
  type ReleaseApi,
  resolveRelease,
} from './release.js';

/** Side-effecting collaborators required by {@link run}, injectable for testing. */
export interface ActionDependencies {
  /** Reads a named action input from the workflow step's `with:` block. */
  getInput: (name: string) => string;
  /** Writes a named action output for downstream steps to consume. */
  setOutput: (name: string, value: string) => void;
  /** Prepends `path` to the runner's `PATH` environment variable. */
  addPath: (path: string) => void;
  /** Logs an informational message to the Actions step summary. */
  info: (message: string) => void;
  /** Factory that creates a {@link ReleaseApi} authenticated with `token`. */
  createReleaseApi: (token: string) => ReleaseApi;
  /** Resolves a version string or `"latest"` to a concrete {@link Release}. */
  resolveRelease: (input: string, api: ReleaseApi) => Promise<Release>;
  /** Looks up the {@link Platform} descriptor for the given `os` and `arch`. */
  resolvePlatform: (os: string, arch: string) => Platform;
  /** Downloads, verifies, and caches the Sprocket binary for `platform`. */
  installRelease: (
    release: Release,
    platform: Platform,
  ) => Promise<Installation>;
  /** The runner process environment, providing `RUNNER_OS` and `RUNNER_ARCH`. */
  environment: NodeJS.ProcessEnv;
}

const defaultDependencies: ActionDependencies = {
  getInput: core.getInput,
  setOutput: core.setOutput,
  addPath: core.addPath,
  info: core.info,
  createReleaseApi,
  resolveRelease,
  resolvePlatform,
  installRelease,
  environment: process.env,
};

/**
 * Entry point for the `setup-sprocket` GitHub Action.
 * Reads `version` and `github-token` inputs, resolves and installs the
 * requested Sprocket release, adds its directory to `PATH`, and sets the
 * `installed-version` output.
 *
 * @throws When `RUNNER_OS` or `RUNNER_ARCH` are absent, or when any
 *   resolution or installation step fails.
 */
export async function run(
  dependencies: ActionDependencies = defaultDependencies,
): Promise<void> {
  const os = dependencies.environment.RUNNER_OS;
  const arch = dependencies.environment.RUNNER_ARCH;
  if (os === undefined || arch === undefined) {
    throw new Error('RUNNER_OS and RUNNER_ARCH must be set by GitHub Actions.');
  }

  const requestedVersion = dependencies.getInput('version').trim() || 'latest';
  const token = dependencies.getInput('github-token').trim();
  const platform = dependencies.resolvePlatform(os, arch);
  const api = dependencies.createReleaseApi(token);

  dependencies.info(
    `Resolving Sprocket ${requestedVersion} for ${os}/${arch}.`,
  );
  const release = await dependencies.resolveRelease(requestedVersion, api);
  const installation = await dependencies.installRelease(release, platform);
  dependencies.addPath(installation.directory);
  dependencies.setOutput('installed-version', release.version);
  dependencies.info(
    `Installed Sprocket ${release.version} at ${installation.executablePath}.`,
  );
}
