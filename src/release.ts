import { Octokit } from '@octokit/rest';

import { assetName, type Platform } from './platform.js';
import { isLatest, normalizeVersion } from './version.js';

const OWNER = 'stjude-rust-labs';
const REPOSITORY = 'sprocket';

export interface ReleaseAsset {
  readonly name: string;
  readonly downloadUrl: string;
  readonly digest: string | null;
}

export interface RawRelease {
  readonly tagName: string;
  readonly assets: readonly ReleaseAsset[];
}

export interface Release {
  readonly version: string;
  readonly assets: readonly ReleaseAsset[];
}

export interface ReleaseApi {
  getLatestRelease(): Promise<RawRelease>;
  getReleaseByTag(tag: string): Promise<RawRelease>;
}

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
    if (status === 403 || status === 429) {
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

function errorStatus(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status;
  }
  return undefined;
}

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
