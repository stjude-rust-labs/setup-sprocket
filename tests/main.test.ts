import { describe, expect, it, vi } from 'vitest';

import { run, type ActionDependencies } from '../src/main.js';
import type { Platform } from '../src/platform.js';
import type { Release, ReleaseApi } from '../src/release.js';

const platform: Platform = {
  os: 'Linux',
  arch: 'X64',
  target: 'x86_64-unknown-linux-gnu',
  extension: 'tar.gz',
  executable: 'sprocket',
};

const release: Release = {
  version: 'v0.27.0',
  assets: [],
};

function dependencies(version = ''): ActionDependencies {
  return {
    getInput: vi.fn((name: string) => {
      if (name === 'version') return version;
      if (name === 'github-token') return 'token';
      return '';
    }),
    setOutput: vi.fn(),
    addPath: vi.fn(),
    info: vi.fn(),
    createReleaseApi: vi.fn().mockReturnValue({} as ReleaseApi),
    resolveRelease: vi.fn().mockResolvedValue(release),
    resolvePlatform: vi.fn().mockReturnValue(platform),
    installRelease: vi.fn().mockResolvedValue({
      directory: '/tool/sprocket',
      executablePath: '/tool/sprocket/sprocket',
    }),
    environment: {
      RUNNER_OS: 'Linux',
      RUNNER_ARCH: 'X64',
    },
  };
}

describe('run', () => {
  it('defaults an empty version input to latest and exports the result', async () => {
    const deps = dependencies();
    await run(deps);
    const { resolveRelease, addPath, setOutput } = deps;
    expect(resolveRelease).toHaveBeenCalledWith('latest', expect.anything());
    expect(addPath).toHaveBeenCalledWith('/tool/sprocket');
    expect(setOutput).toHaveBeenCalledWith('installed-version', 'v0.27.0');
  });

  it('passes an explicit version to release resolution', async () => {
    const deps = dependencies('0.27.0');
    await run(deps);
    const { resolveRelease } = deps;
    expect(resolveRelease).toHaveBeenCalledWith('0.27.0', expect.anything());
  });

  it('fails clearly outside a GitHub runner', async () => {
    const deps = dependencies();
    deps.environment = {};
    await expect(run(deps)).rejects.toThrow(
      'RUNNER_OS and RUNNER_ARCH must be set by GitHub Actions.',
    );
  });

  it('trims whitespace from version input', async () => {
    const deps = dependencies('  v0.27.0  ');
    await run(deps);
    const { resolveRelease } = deps;
    expect(resolveRelease).toHaveBeenCalledWith('v0.27.0', expect.anything());
  });
});
