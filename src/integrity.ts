import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

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
  const algorithm = separator === -1 ? digest : digest.slice(0, separator);
  const expected = separator === -1 ? '' : digest.slice(separator + 1);
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
