import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

/**
 * Verifies that the file at `path` matches `digest` (format `"algorithm:hex"`).
 * Emits a `warning` and returns without error when `digest` is `null`.
 *
 * @throws For a malformed digest string, an unsupported algorithm, or a checksum mismatch.
 */
export async function verifyDigest(
  path: string,
  digest: string | null,
  warning: (message: string) => void,
): Promise<void> {
  if (digest === null) {
    warning(
      'GitHub does not provide a digest for this older release asset; relying on HTTPS transport integrity.',
    );
    return;
  }

  const separator = digest.indexOf(':');
  if (separator === -1) {
    throw new Error(
      'Malformed release asset digest: expected format "algorithm:hex", got "' +
        digest +
        '".',
    );
  }
  const algorithm = digest.slice(0, separator);
  const expected = digest.slice(separator + 1);
  if (algorithm !== 'sha256') {
    throw new Error(
      `Unsupported release asset digest algorithm: ${algorithm}.`,
    );
  }

  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk as Buffer | string);
  }
  const actual = hash.digest('hex');
  if (actual !== expected.toLowerCase()) {
    throw new Error(
      `Release asset checksum mismatch: expected ${expected.toLowerCase()}, calculated ${actual}.`,
    );
  }
}
