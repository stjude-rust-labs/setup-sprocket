import { Octokit } from '@octokit/rest';

import { errorStatus, isRateLimitError, OWNER, REPOSITORY } from './github.js';

/** A named branch resolved to an immutable Git commit. */
export interface BranchRevision {
  /** The resolved branch name returned by GitHub. */
  readonly name: string;
  /** The full commit SHA at the branch tip. */
  readonly commitSha: string;
}

/** Abstraction over the GitHub branch endpoint. */
export interface BranchApi {
  /** Resolves `branch` to its immutable tip commit. */
  getBranch(branch: string): Promise<BranchRevision>;
}

/** Creates a GitHub-backed branch API. */
export function createBranchApi(token: string): BranchApi {
  const octokit = new Octokit(token === '' ? {} : { auth: token });
  return {
    async getBranch(branch: string): Promise<BranchRevision> {
      const response = await octokit.rest.repos.getBranch({
        owner: OWNER,
        repo: REPOSITORY,
        branch,
      });
      return {
        name: response.data.name,
        commitSha: response.data.commit.sha,
      };
    },
  };
}

/** Resolves a branch name and translates GitHub failures into action errors. */
export async function resolveBranch(
  input: string,
  api: BranchApi,
): Promise<BranchRevision> {
  const name = input.trim();
  if (name === '') {
    throw new Error('Sprocket branch must not be empty.');
  }

  try {
    return await api.getBranch(name);
  } catch (error) {
    const status = errorStatus(error);
    if (status === 404) {
      throw new Error(`Sprocket branch ${name} was not found.`, {
        cause: error,
      });
    }
    if (status === 429 || (status === 403 && isRateLimitError(error))) {
      throw new Error(
        'GitHub rejected the Sprocket branch request; pass github-token or retry after the API rate limit resets.',
        { cause: error },
      );
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to query Sprocket branch ${name}: ${detail}`, {
      cause: error,
    });
  }
}
