import { describe, expect, it, vi } from 'vitest';

import { run, type ActionDependencies } from '../src/main.js';
import type { Platform } from '../src/platform.js';
import type { Release } from '../src/release.js';

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

function dependencies(version = '', branch = ''): ActionDependencies {
  return {
    getInput: vi.fn((name: string) => {
      if (name === 'version') return version;
      if (name === 'branch') return branch;
      if (name === 'github-token') return 'token';
      return '';
    }),
    setOutput: vi.fn(),
    addPath: vi.fn(),
    info: vi.fn(),
    createReleaseApi: vi.fn().mockReturnValue({}),
    createBranchApi: vi.fn().mockReturnValue({}),
    resolveRelease: vi.fn().mockResolvedValue(release),
    resolveBranch: vi.fn().mockResolvedValue({
      name: 'feature/example',
      commitSha: '0123456789abcdef0123456789abcdef01234567',
    }),
    resolvePlatform: vi.fn().mockReturnValue(platform),
    installRelease: vi.fn().mockResolvedValue({
      directory: '/tool/sprocket',
      executablePath: '/tool/sprocket/sprocket',
    }),
    installSource: vi.fn().mockResolvedValue({
      directory: '/tool/source',
      executablePath: '/tool/source/sprocket',
      version: 'v0.28.0',
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
    expect(deps.info).toHaveBeenNthCalledWith(
      1,
      'Resolving Sprocket `latest` for `Linux/X64`.',
    );
    expect(deps.info).toHaveBeenNthCalledWith(
      2,
      'Installed Sprocket `v0.27.0` at `/tool/sprocket/sprocket`.',
    );
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

  it('defaults whitespace-only version input to latest', async () => {
    const deps = dependencies('   ');
    await run(deps);
    const { resolveRelease } = deps;
    expect(resolveRelease).toHaveBeenCalledWith('latest', expect.anything());
  });

  it('installs an explicitly selected branch', async () => {
    const deps = dependencies('', '  feature/example  ');
    await run(deps);

    expect(deps.resolveBranch).toHaveBeenCalledWith(
      'feature/example',
      expect.anything(),
    );
    expect(deps.installSource).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'feature/example' }),
      platform,
    );
    expect(deps.addPath).toHaveBeenCalledWith('/tool/source');
    expect(deps.resolveRelease).not.toHaveBeenCalled();
    expect(deps.setOutput).toHaveBeenCalledWith('installed-version', 'v0.28.0');
    expect(deps.info).toHaveBeenNthCalledWith(
      1,
      'Resolving Sprocket branch `feature/example` for `Linux/X64`.',
    );
    expect(deps.info).toHaveBeenNthCalledWith(
      2,
      `Installed Sprocket branch \`feature/example\` at \`0123456789abcdef0123456789abcdef01234567\` from source.`,
    );
    expect(deps.info).toHaveBeenNthCalledWith(
      3,
      'Installed Sprocket `v0.28.0` at `/tool/source/sprocket`.',
    );
  });

  it('rejects simultaneous version and branch selectors', async () => {
    const deps = dependencies('0.27.0', 'main');
    await expect(run(deps)).rejects.toThrow(
      'version and branch are mutually exclusive; provide only one.',
    );
    expect(deps.resolveRelease).not.toHaveBeenCalled();
    expect(deps.resolveBranch).not.toHaveBeenCalled();
  });
});
