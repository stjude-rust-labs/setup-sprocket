import { describe, expect, it, vi } from 'vitest';

import { type BranchApi, resolveBranch } from '../src/branch.js';

describe('resolveBranch', () => {
  it('trims a branch and returns its immutable commit', async () => {
    const getBranch = vi.fn().mockResolvedValue({
      name: 'feature/example',
      commitSha: '0123456789abcdef0123456789abcdef01234567',
    });
    const api: BranchApi = { getBranch };

    await expect(resolveBranch('  feature/example  ', api)).resolves.toEqual({
      name: 'feature/example',
      commitSha: '0123456789abcdef0123456789abcdef01234567',
    });
    expect(getBranch).toHaveBeenCalledWith('feature/example');
  });

  it('rejects an empty branch', async () => {
    const api: BranchApi = { getBranch: vi.fn() };
    await expect(resolveBranch('   ', api)).rejects.toThrow(
      'Sprocket branch must not be empty.',
    );
  });

  it('reports an unknown branch', async () => {
    const api: BranchApi = {
      getBranch: vi.fn().mockRejectedValue({ status: 404 }),
    };
    await expect(resolveBranch('missing', api)).rejects.toThrow(
      'Sprocket branch missing was not found.',
    );
  });

  it('explains rate-limit failures', async () => {
    const api: BranchApi = {
      getBranch: vi.fn().mockRejectedValue({
        status: 403,
        message: 'API rate limit exceeded',
      }),
    };
    await expect(resolveBranch('main', api)).rejects.toThrow(
      'GitHub rejected the Sprocket branch request; pass github-token or retry after the API rate limit resets.',
    );
  });

  it('adds context to other GitHub failures', async () => {
    const api: BranchApi = {
      getBranch: vi.fn().mockRejectedValue(new Error('network unavailable')),
    };
    await expect(resolveBranch('main', api)).rejects.toThrow(
      'Failed to query Sprocket branch main: network unavailable',
    );
  });
});
