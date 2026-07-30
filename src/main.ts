import * as core from '@actions/core';

import {
  createBranchApi,
  type BranchApi,
  type BranchRevision,
  resolveBranch,
} from './branch.js';
import { installRelease, type Installation } from './install.js';
import { resolvePlatform, type Platform } from './platform.js';
import {
  createReleaseApi,
  type Release,
  type ReleaseApi,
  resolveRelease,
} from './release.js';
import { installSource, type SourceInstallation } from './source-install.js';

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
  /** Factory that creates a {@link BranchApi} authenticated with `token`. */
  createBranchApi: (token: string) => BranchApi;
  /** Resolves a version string or `"latest"` to a concrete {@link Release}. */
  resolveRelease: (input: string, api: ReleaseApi) => Promise<Release>;
  /** Resolves a branch name to an immutable Sprocket revision. */
  resolveBranch: (input: string, api: BranchApi) => Promise<BranchRevision>;
  /** Looks up the {@link Platform} descriptor for the given `os` and `arch`. */
  resolvePlatform: (os: string, arch: string) => Platform;
  /** Downloads, verifies, and caches the Sprocket binary for `platform`. */
  installRelease: (
    release: Release,
    platform: Platform,
  ) => Promise<Installation>;
  /** Builds, verifies, and caches the Sprocket source revision for `platform`. */
  installSource: (
    revision: BranchRevision,
    platform: Platform,
  ) => Promise<SourceInstallation>;
  /** The runner process environment, providing `RUNNER_OS` and `RUNNER_ARCH`. */
  environment: NodeJS.ProcessEnv;
}

const defaultDependencies: ActionDependencies = {
  getInput: core.getInput,
  setOutput: core.setOutput,
  addPath: core.addPath,
  info: core.info,
  createReleaseApi,
  createBranchApi,
  resolveRelease,
  resolveBranch,
  resolvePlatform,
  installRelease,
  installSource,
  environment: process.env,
};

/**
 * Entry point for the `setup-sprocket` GitHub Action.
 * Reads `version`, `branch`, and `github-token` inputs, resolves and installs
 * the requested Sprocket release or branch, adds its directory to `PATH`, and
 * sets the `installed-version` output.
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

  const requestedVersion = dependencies.getInput('version').trim();
  const requestedBranch = dependencies.getInput('branch').trim();
  if (requestedVersion !== '' && requestedBranch !== '') {
    throw new Error(
      'version and branch are mutually exclusive; provide only one.',
    );
  }

  const token = dependencies.getInput('github-token').trim();
  const platform = dependencies.resolvePlatform(os, arch);

  let installation: Installation | SourceInstallation;
  let installedVersion: string;
  if (requestedBranch !== '') {
    dependencies.info(
      `Resolving Sprocket branch \`${requestedBranch}\` for \`${os}/${arch}\`.`,
    );
    const api = dependencies.createBranchApi(token);
    const revision = await dependencies.resolveBranch(requestedBranch, api);
    const sourceInstallation = await dependencies.installSource(
      revision,
      platform,
    );
    installation = sourceInstallation;
    installedVersion = sourceInstallation.version;
    dependencies.info(
      `Installed Sprocket branch \`${revision.name}\` at \`${revision.commitSha}\` from source.`,
    );
  } else {
    const version = requestedVersion || 'latest';
    dependencies.info(
      `Resolving Sprocket \`${version}\` for \`${os}/${arch}\`.`,
    );
    const api = dependencies.createReleaseApi(token);
    const release = await dependencies.resolveRelease(version, api);
    installation = await dependencies.installRelease(release, platform);
    installedVersion = release.version;
  }

  dependencies.addPath(installation.directory);
  dependencies.setOutput('installed-version', installedVersion);
  dependencies.info(
    `Installed Sprocket \`${installedVersion}\` at \`${installation.executablePath}\`.`,
  );
}
