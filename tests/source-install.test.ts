import { describe, expect, it, vi } from 'vitest';

import type { BranchRevision } from '../src/branch.js';
import { resolvePlatform } from '../src/platform.js';
import {
  installSource,
  parseSprocketVersion,
  type SourceInstallDependencies,
} from '../src/source-install.js';

interface MockedDependencies {
  deps: SourceInstallDependencies;
  find: ReturnType<typeof vi.fn<SourceInstallDependencies['find']>>;
  cacheDir: ReturnType<typeof vi.fn<SourceInstallDependencies['cacheDir']>>;
  makeTempDirectory: ReturnType<
    typeof vi.fn<SourceInstallDependencies['makeTempDirectory']>
  >;
  removeDirectory: ReturnType<
    typeof vi.fn<SourceInstallDependencies['removeDirectory']>
  >;
  access: ReturnType<typeof vi.fn<SourceInstallDependencies['access']>>;
  execute: ReturnType<typeof vi.fn<SourceInstallDependencies['execute']>>;
  info: ReturnType<typeof vi.fn<SourceInstallDependencies['info']>>;
}

const revision: BranchRevision = {
  name: 'main',
  commitSha: '0123456789abcdef0123456789abcdef01234567',
};

function dependencies(): MockedDependencies {
  const find = vi.fn<SourceInstallDependencies['find']>().mockReturnValue('');
  const cacheDir = vi
    .fn<SourceInstallDependencies['cacheDir']>()
    .mockResolvedValue('/tool/cache/sprocket');
  const makeTempDirectory = vi
    .fn<SourceInstallDependencies['makeTempDirectory']>()
    .mockResolvedValue('/tmp/source-root');
  const removeDirectory = vi
    .fn<SourceInstallDependencies['removeDirectory']>()
    .mockResolvedValue(undefined);
  const access = vi
    .fn<SourceInstallDependencies['access']>()
    .mockResolvedValue(undefined);
  const execute = vi
    .fn<SourceInstallDependencies['execute']>()
    .mockImplementation((file) => {
      if (file === 'cargo') {
        return Promise.resolve('');
      }
      return Promise.resolve('sprocket 0.28.0 (0123456 2026-07-30)');
    });
  const info = vi.fn<SourceInstallDependencies['info']>();

  return {
    find,
    cacheDir,
    makeTempDirectory,
    removeDirectory,
    access,
    execute,
    info,
    deps: {
      find,
      cacheDir,
      makeTempDirectory,
      removeDirectory,
      access,
      execute,
      info,
    },
  };
}

async function expectContextualError(
  promise: Promise<unknown>,
  message: string,
  cause: unknown,
): Promise<void> {
  await expect(promise).rejects.toThrow(message);
  await expect(promise).rejects.toMatchObject({ cause });
}

function makeVersionExecute(
  output: string,
): SourceInstallDependencies['execute'] {
  return (file) => {
    if (file === 'cargo' || file === 'git') {
      return Promise.resolve('');
    }
    return Promise.resolve(output);
  };
}

function makeFailingVersionExecute(
  failure: Error,
): SourceInstallDependencies['execute'] {
  return (file) => {
    if (file === 'cargo' || file === 'git') {
      return Promise.resolve('');
    }
    return Promise.reject(failure);
  };
}

describe('parseSprocketVersion', () => {
  it('normalizes the package version from testament output', () => {
    expect(parseSprocketVersion('sprocket 0.28.0 (0123456 2026-07-30)\n')).toBe(
      'v0.28.0',
    );
  });

  it.each([
    ['sprocket 0.29.0-dev (0123456 2026-07-30)', 'v0.29.0'],
    ['sprocket 0.29.0-alpha.1', 'v0.29.0'],
    ['sprocket 0.29.0+build', 'v0.29.0'],
  ])('normalizes the package core from %s', (output, version) => {
    expect(parseSprocketVersion(output)).toBe(version);
  });

  it('does not apply the binary release minimum to source versions', () => {
    expect(parseSprocketVersion('sprocket 0.7.0-dev')).toBe('v0.7.0');
  });

  it('rejects unrecognized output', () => {
    expect(() => parseSprocketVersion('unexpected')).toThrow(
      'Could not determine the installed Sprocket version from "unexpected".',
    );
  });
});

describe('installSource', () => {
  it('builds the resolved commit from a checkout that retains tags', async () => {
    const { deps, cacheDir, execute, info, removeDirectory } = dependencies();
    const platform = resolvePlatform('Linux', 'X64');

    const installation = await installSource(revision, platform, deps);

    expect(execute).toHaveBeenNthCalledWith(1, 'git', [
      'clone',
      '--filter=blob:none',
      '--no-checkout',
      'https://github.com/stjude-rust-labs/sprocket.git',
      '/tmp/source-root/source',
    ]);
    expect(execute).toHaveBeenNthCalledWith(2, 'git', [
      '-C',
      '/tmp/source-root/source',
      'checkout',
      '--detach',
      revision.commitSha,
    ]);
    expect(execute).toHaveBeenNthCalledWith(3, 'cargo', [
      'install',
      '--path',
      '/tmp/source-root/source',
      '--locked',
      '--root',
      '/tmp/source-root',
      'sprocket',
    ]);
    expect(cacheDir).toHaveBeenCalledWith(
      '/tmp/source-root/bin',
      'sprocket',
      `0.0.0-branch.${revision.commitSha}`,
      platform.target,
    );
    expect(installation).toEqual({
      directory: '/tool/cache/sprocket',
      executablePath: '/tool/cache/sprocket/sprocket',
      version: 'v0.28.0',
    });
    expect(removeDirectory).toHaveBeenCalledWith('/tmp/source-root');
    expect(info.mock.calls).toEqual([
      [
        `Checking cache for Sprocket branch \`main\` at \`${revision.commitSha}\` for target \`${platform.target}\`.`,
      ],
      [
        `No cached build found for commit \`${revision.commitSha}\`; building from source.`,
      ],
      [
        'Cloning `https://github.com/stjude-rust-labs/sprocket.git` into `/tmp/source-root/source`.',
      ],
      [`Checking out commit \`${revision.commitSha}\`.`],
      [
        'Building Sprocket from `/tmp/source-root/source` with `cargo install --locked`.',
      ],
      [`Caching source build for commit \`${revision.commitSha}\`.`],
      ['Verifying executable `/tool/cache/sprocket/sprocket`.'],
    ]);
  });

  it('reuses a commit-specific cache entry', async () => {
    const { deps, execute, find, info, makeTempDirectory } = dependencies();
    const platform = resolvePlatform('Windows', 'X64');
    find.mockReturnValue('/tool/cache/sprocket');

    await installSource(revision, platform, deps);

    expect(makeTempDirectory).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledWith('/tool/cache/sprocket/sprocket.exe', [
      '--version',
    ]);
    expect(info.mock.calls).toEqual([
      [
        `Checking cache for Sprocket branch \`main\` at \`${revision.commitSha}\` for target \`${platform.target}\`.`,
      ],
      ['Using cached Sprocket branch `main` from `/tool/cache/sprocket`.'],
      ['Verifying executable `/tool/cache/sprocket/sprocket.exe`.'],
    ]);
  });

  it('removes the temporary root after a failed Cargo build', async () => {
    const { deps, execute, removeDirectory } = dependencies();
    const failure = new Error('compiler failed');
    execute.mockReset();
    execute.mockImplementation((file) =>
      file === 'cargo' ? Promise.reject(failure) : Promise.resolve(''),
    );

    const promise = installSource(
      revision,
      resolvePlatform('Linux', 'X64'),
      deps,
    );
    await expectContextualError(
      promise,
      `Failed to install Sprocket branch main at ${revision.commitSha}: compiler failed`,
      failure,
    );
    expect(removeDirectory).toHaveBeenCalledWith('/tmp/source-root');
  });

  it('reports a missing installed executable with the original cause', async () => {
    const { access, cacheDir, deps, removeDirectory } = dependencies();
    const failure = new Error('permission denied');
    access.mockRejectedValue(failure);

    const promise = installSource(
      revision,
      resolvePlatform('Linux', 'X64'),
      deps,
    );

    await expectContextualError(
      promise,
      'Cargo did not install sprocket for Sprocket branch main: permission denied',
      failure,
    );
    expect(cacheDir).not.toHaveBeenCalled();
    expect(removeDirectory).toHaveBeenCalledWith('/tmp/source-root');
  });

  it('reports cache persistence failures with the original cause', async () => {
    const { cacheDir, deps, removeDirectory } = dependencies();
    const failure = new Error('cache quota exceeded');
    cacheDir.mockRejectedValue(failure);

    const promise = installSource(
      revision,
      resolvePlatform('Linux', 'X64'),
      deps,
    );

    await expectContextualError(
      promise,
      `Failed to cache Sprocket branch main at ${revision.commitSha}: cache quota exceeded`,
      failure,
    );
    expect(removeDirectory).toHaveBeenCalledWith('/tmp/source-root');
  });

  it('reports installed executable command failures with the original cause', async () => {
    const { deps, execute } = dependencies();
    const failure = new Error('permission denied');
    execute.mockImplementation(makeFailingVersionExecute(failure));

    const promise = installSource(
      revision,
      resolvePlatform('Linux', 'X64'),
      deps,
    );

    await expectContextualError(
      promise,
      `Installed Sprocket branch main at ${revision.commitSha} did not run: permission denied`,
      failure,
    );
  });

  it('reports installed executable version parsing failures with the original cause', async () => {
    const { deps, execute } = dependencies();
    execute.mockImplementation(makeVersionExecute('unexpected'));

    const promise = installSource(
      revision,
      resolvePlatform('Linux', 'X64'),
      deps,
    );

    const expectedCause = new Error(
      'Could not determine the installed Sprocket version from "unexpected".',
    );
    await expectContextualError(
      promise,
      `Installed Sprocket branch main at ${revision.commitSha} did not report a valid version: Could not determine the installed Sprocket version from "unexpected".`,
      expectedCause,
    );
  });
});
