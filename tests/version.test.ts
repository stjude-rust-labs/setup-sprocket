import { describe, expect, it } from 'vitest';

import { isLatest, normalizeVersion } from '../src/version.js';

describe('isLatest', () => {
  it('accepts latest case-insensitively with surrounding whitespace', () => {
    expect(isLatest(' Latest ')).toBe(true);
  });
});

describe('normalizeVersion', () => {
  it.each([
    ['0.28.0', 'v0.28.0'],
    ['v0.28.0', 'v0.28.0'],
    [' 0.8.0 ', 'v0.8.0'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeVersion(input)).toBe(expected);
  });

  it.each(['', 'latest', '0.28', '1.2.3-beta.1', '^0.28.0', 'version-1'])(
    'rejects invalid explicit version %s',
    (input) => {
      expect(() => normalizeVersion(input)).toThrow(/semantic version/i);
    },
  );

  it('rejects releases before v0.8.0', () => {
    expect(() => normalizeVersion('v0.7.0')).toThrow(
      'Sprocket v0.7.0 is unsupported; binary releases begin at v0.8.0.',
    );
  });
});
