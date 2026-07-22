import { describe, expect, it, vi } from 'vitest';

import { resolvePlatform } from '../src/platform.js';
import {
  type RawRelease,
  type ReleaseApi,
  resolveRelease,
  selectAsset,
} from '../src/release.js';

function apiWith(release: RawRelease): ReleaseApi {
  return {
    getLatestRelease: vi.fn().mockResolvedValue(release),
    getReleaseByTag: vi.fn().mockResolvedValue(release),
  };
}

const completeRelease: RawRelease = {
  tagName: 'v0.27.0',
  assets: [
    {
      name: 'sprocket-v0.27.0-x86_64-unknown-linux-gnu.tar.gz',
      downloadUrl: 'https://example.invalid/sprocket-linux.tar.gz',
      digest: 'sha256:abc123',
    },
  ],
};

describe('resolveRelease', () => {
  it('uses the latest stable endpoint for latest', async () => {
    const getLatestRelease = vi.fn<() => Promise<RawRelease>>().mockResolvedValue(completeRelease);
    const getReleaseByTag = vi.fn<(tag: string) => Promise<RawRelease>>().mockResolvedValue(completeRelease);
    const api: ReleaseApi = { getLatestRelease, getReleaseByTag };
    const release = await resolveRelease('latest', api);
    expect(getLatestRelease).toHaveBeenCalledOnce();
    expect(getReleaseByTag).not.toHaveBeenCalled();
    expect(release.version).toBe('v0.27.0');
  });

  it('looks up explicit versions by normalized tag', async () => {
    const getReleaseByTag = vi.fn<(tag: string) => Promise<RawRelease>>().mockResolvedValue(completeRelease);
    const api: ReleaseApi = {
      getLatestRelease: vi.fn(),
      getReleaseByTag,
    };
    const release = await resolveRelease('0.27.0', api);
    expect(getReleaseByTag).toHaveBeenCalledWith('v0.27.0');
    expect(release.version).toBe('v0.27.0');
  });

  it('rejects a latest release whose tag is malformed', async () => {
    const api = apiWith({ tagName: 'nightly', assets: [] });
    await expect(resolveRelease('latest', api)).rejects.toThrow(
      /exact semantic version/i,
    );
  });

  it('reports an explicit release that does not exist', async () => {
    const getReleaseByTag = vi.fn<(tag: string) => Promise<RawRelease>>().mockRejectedValue({
      status: 404,
      message: 'Not Found',
    });
    const api: ReleaseApi = {
      getLatestRelease: vi.fn(),
      getReleaseByTag,
    };
    await expect(resolveRelease('0.29.0', api)).rejects.toThrow(
      'Sprocket release v0.29.0 was not found.',
    );
  });

  it('explains API rate-limit failures', async () => {
    const getLatestRelease = vi.fn<() => Promise<RawRelease>>().mockRejectedValue({
      status: 403,
      message: 'API rate limit exceeded',
    });
    const api: ReleaseApi = {
      getLatestRelease,
      getReleaseByTag: vi.fn(),
    };
    await expect(resolveRelease('latest', api)).rejects.toThrow(
      'GitHub rejected the Sprocket release request; pass github-token or retry after the API rate limit resets.',
    );
  });

  it('non-rate-limit 403 yields the generic error', async () => {
    const getLatestRelease = vi.fn<() => Promise<RawRelease>>().mockRejectedValue({
      status: 403,
      message: 'Forbidden',
    });
    const api: ReleaseApi = {
      getLatestRelease,
      getReleaseByTag: vi.fn(),
    };
    await expect(resolveRelease('latest', api)).rejects.toThrow(
      /Failed to query Sprocket releases/,
    );
  });
});

describe('selectAsset', () => {
  it('returns the exact platform asset', () => {
    const platform = resolvePlatform('Linux', 'X64');
    expect(
      selectAsset(
        { version: 'v0.27.0', assets: completeRelease.assets },
        platform,
      ),
    ).toEqual(completeRelease.assets[0]);
  });

  it('distinguishes an asset-less release', () => {
    const platform = resolvePlatform('Linux', 'X64');
    expect(() =>
      selectAsset({ version: 'v0.8.0', assets: [] }, platform),
    ).toThrow('Sprocket v0.8.0 publishes no installable binary assets.');
  });

  it('reports a release that omits the detected target', () => {
    const platform = resolvePlatform('macOS', 'X64');
    expect(() =>
      selectAsset(
        { version: 'v0.28.0', assets: completeRelease.assets },
        platform,
      ),
    ).toThrow(
      'Sprocket v0.28.0 does not publish sprocket-v0.28.0-x86_64-apple-darwin.tar.gz for runner macOS/X64.',
    );
  });
});
