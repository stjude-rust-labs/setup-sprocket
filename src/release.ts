import { Octokit } from '@octokit/rest';

import { errorStatus, isRateLimitError, OWNER, REPOSITORY } from './github.js';
import { assetName, type Platform } from './platform.js';
import { isLatest, normalizeVersion } from './version.js';

/** Describes a single downloadable file attached to a GitHub release. */
export interface ReleaseAsset {
  /** The filename of the asset (e.g. `"sprocket-v0.28.0-x86_64-unknown-linux-gnu.tar.gz"`). */
  readonly name: string;
  /** The direct HTTPS URL for downloading the asset. */
  readonly downloadUrl: string;
  /** The `"algorithm:hex"` integrity digest provided by GitHub, or `null` for older releases. */
  readonly digest: string | null;
}

/** Raw payload returned by the GitHub Releases API before version normalisation. */
export interface RawRelease {
  /** The `tag_name` field from the GitHub Releases API response (e.g. `"v0.28.0"`). */
  readonly tagName: string;
  /** All assets attached to the release. */
  readonly assets: readonly ReleaseAsset[];
}

/** A Sprocket GitHub release with its normalised version tag and downloadable assets. */
export interface Release {
  /** Canonical `v<major>.<minor>.<patch>` version string. */
  readonly version: string;
  /** All assets attached to this release. */
  readonly assets: readonly ReleaseAsset[];
}

/** Abstraction over the GitHub Releases API used to fetch Sprocket release metadata. */
export interface ReleaseApi {
  /** Fetches the most-recently-published Sprocket release. */
  getLatestRelease(): Promise<RawRelease>;
  /** Fetches the Sprocket release that matches the exact `tag` (e.g. `"v0.28.0"`). */
  getReleaseByTag(tag: string): Promise<RawRelease>;
}

/** Creates a {@link ReleaseApi} backed by Octokit, authenticated with `token` when non-empty. */
export function createReleaseApi(token: string): ReleaseApi {
  const octokit = new Octokit(token === '' ? {} : { auth: token });

  const convert = (
    data: Awaited<
      ReturnType<typeof octokit.rest.repos.getLatestRelease>
    >['data'],
  ): RawRelease => ({
    tagName: data.tag_name,
    assets: data.assets.map((asset) => ({
      name: asset.name,
      downloadUrl: asset.browser_download_url,
      digest: asset.digest ?? null,
    })),
  });

  return {
    async getLatestRelease(): Promise<RawRelease> {
      const response = await octokit.rest.repos.getLatestRelease({
        owner: OWNER,
        repo: REPOSITORY,
      });
      return convert(response.data);
    },
    async getReleaseByTag(tag: string): Promise<RawRelease> {
      const response = await octokit.rest.repos.getReleaseByTag({
        owner: OWNER,
        repo: REPOSITORY,
        tag,
      });
      return convert(response.data);
    },
  };
}

/**
 * Resolves the requested version `input` (`"latest"` or a semver string) to a
 * concrete {@link Release} by calling the appropriate {@link ReleaseApi} method.
 *
 * @throws For 404 (unknown tag), rate-limit, or other API failures.
 */
export async function resolveRelease(
  input: string,
  api: ReleaseApi,
): Promise<Release> {
  const latest = isLatest(input);
  const requestedVersion = latest ? '' : normalizeVersion(input);
  let raw: RawRelease;
  try {
    raw = latest
      ? await api.getLatestRelease()
      : await api.getReleaseByTag(requestedVersion);
  } catch (error) {
    const status = errorStatus(error);
    if (status === 404 && !latest) {
      throw new Error(`Sprocket release ${requestedVersion} was not found.`, {
        cause: error,
      });
    }
    if (status === 429 || (status === 403 && isRateLimitError(error))) {
      throw new Error(
        'GitHub rejected the Sprocket release request; pass github-token or retry after the API rate limit resets.',
        { cause: error },
      );
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to query Sprocket releases: ${detail}`, {
      cause: error,
    });
  }
  const version = normalizeVersion(raw.tagName);
  return { version, assets: raw.assets };
}

/**
 * Finds the release asset whose filename matches `platform` inside `release`.
 *
 * @throws When the release has no assets or lacks an asset for the requested platform.
 */
export function selectAsset(
  release: Release,
  platform: Platform,
): ReleaseAsset {
  if (release.assets.length === 0) {
    throw new Error(
      `Sprocket ${release.version} publishes no installable binary assets.`,
    );
  }

  const expectedName = assetName(release.version, platform);
  const asset = release.assets.find(({ name }) => name === expectedName);
  if (asset === undefined) {
    throw new Error(
      `Sprocket ${release.version} does not publish ${expectedName} for runner ${platform.os}/${platform.arch}.`,
    );
  }
  return asset;
}
