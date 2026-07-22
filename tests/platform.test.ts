import { describe, expect, it } from 'vitest';

import { assetName, resolvePlatform } from '../src/platform.js';

describe('resolvePlatform', () => {
  it.each([
    ['Linux', 'X64', 'x86_64-unknown-linux-gnu', 'tar.gz', 'sprocket'],
    ['Linux', 'ARM64', 'aarch64-unknown-linux-gnu', 'tar.gz', 'sprocket'],
    ['macOS', 'X64', 'x86_64-apple-darwin', 'tar.gz', 'sprocket'],
    ['macOS', 'ARM64', 'aarch64-apple-darwin', 'tar.gz', 'sprocket'],
    ['Windows', 'X64', 'x86_64-pc-windows-msvc', 'zip', 'sprocket.exe'],
    ['Windows', 'ARM64', 'aarch64-pc-windows-msvc', 'zip', 'sprocket.exe'],
  ])('maps %s/%s to %s', (os, arch, target, extension, executable) => {
    expect(resolvePlatform(os, arch)).toEqual({
      os,
      arch,
      target,
      extension,
      executable,
    });
  });

  it.each([
    ['FreeBSD', 'X64'],
    ['Linux', 'ARM'],
    ['Windows', 'X86'],
  ])('rejects unsupported runner %s/%s', (os, arch) => {
    expect(() => resolvePlatform(os, arch)).toThrow(
      `Sprocket does not publish binaries for runner ${os}/${arch}.`,
    );
  });
});

describe('assetName', () => {
  it('builds the exact Linux x64 release asset name', () => {
    const platform = resolvePlatform('Linux', 'X64');
    expect(assetName('v0.28.0', platform)).toBe(
      'sprocket-v0.28.0-x86_64-unknown-linux-gnu.tar.gz',
    );
  });
});
