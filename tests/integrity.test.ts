import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { verifyDigest } from '../src/integrity.js';

async function fixture(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'setup-sprocket-'));
  const path = join(directory, 'archive');
  await writeFile(path, contents);
  return path;
}

describe('verifyDigest', () => {
  it('accepts a matching SHA-256 digest', async () => {
    const path = await fixture('sprocket');
    await expect(
      verifyDigest(
        path,
        'sha256:c570e0e3fb51259da717a6c34a61714f1a6106cf9c67cddcd0b54c309713be9d',
        vi.fn(),
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects a mismatched digest', async () => {
    const path = await fixture('sprocket');
    await expect(
      verifyDigest(path, `sha256:${'0'.repeat(64)}`, vi.fn()),
    ).rejects.toThrow(/checksum mismatch/i);
  });

  it('warns when old release metadata has no digest', async () => {
    const path = await fixture('sprocket');
    const warning = vi.fn();
    await verifyDigest(path, null, warning);
    expect(warning).toHaveBeenCalledWith(
      'GitHub does not provide a digest for this older release asset; relying on HTTPS transport integrity.',
    );
  });

  it('rejects an unsupported digest algorithm', async () => {
    const path = await fixture('sprocket');
    await expect(verifyDigest(path, 'sha512:abc123', vi.fn())).rejects.toThrow(
      'Unsupported release asset digest algorithm: sha512.',
    );
  });

  it('rejects a colon-free digest as malformed', async () => {
    const path = await fixture('sprocket');
    await expect(verifyDigest(path, 'sha256', vi.fn())).rejects.toThrow(
      /malformed.*algorithm:hex/i,
    );
  });
});
