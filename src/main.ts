import * as core from '@actions/core';

import { installRelease, type Installation } from './install.js';
import { resolvePlatform, type Platform } from './platform.js';
import {
  createReleaseApi,
  type Release,
  type ReleaseApi,
  resolveRelease,
} from './release.js';

export interface ActionDependencies {
  getInput: (name: string) => string;
  setOutput: (name: string, value: string) => void;
  addPath: (path: string) => void;
  info: (message: string) => void;
  createReleaseApi: (token: string) => ReleaseApi;
  resolveRelease: (input: string, api: ReleaseApi) => Promise<Release>;
  resolvePlatform: (os: string, arch: string) => Platform;
  installRelease: (
    release: Release,
    platform: Platform,
  ) => Promise<Installation>;
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
