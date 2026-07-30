/** GitHub owner for the upstream Sprocket repository. */
const OWNER = 'stjude-rust-labs';

/** GitHub repository name for upstream Sprocket. */
const REPOSITORY = 'sprocket';

/** Clone URL for the upstream Sprocket repository. */
const REPOSITORY_URL = `https://github.com/${OWNER}/${REPOSITORY}.git`;

export { OWNER, REPOSITORY, REPOSITORY_URL };

/** Returns the HTTP status carried by an Octokit-style error, when present. */
export function errorStatus(error: unknown): number | undefined {
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

/** Returns whether an error message identifies a GitHub API rate limit. */
export function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    /rate limit/i.test(error.message)
  );
}
