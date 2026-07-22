/** Identifies a runner platform as the combination of OS, architecture, Rust target triple, archive format, and executable name. */
export interface Platform {
  /** The GitHub Actions `RUNNER_OS` value (e.g. `"Linux"`, `"macOS"`, `"Windows"`). */
  readonly os: string;
  /** The GitHub Actions `RUNNER_ARCH` value (e.g. `"X64"`, `"ARM64"`). */
  readonly arch: string;
  /** The Rust target triple used in Sprocket release asset filenames (e.g. `"x86_64-unknown-linux-gnu"`). */
  readonly target: string;
  /** The archive format used for this platform's release asset. */
  readonly extension: 'tar.gz' | 'zip';
  /** The name of the Sprocket executable inside the release archive. */
  readonly executable: 'sprocket' | 'sprocket.exe';
}

const PLATFORMS: ReadonlyMap<string, Omit<Platform, 'os' | 'arch'>> = new Map([
  [
    'Linux/X64',
    {
      target: 'x86_64-unknown-linux-gnu',
      extension: 'tar.gz',
      executable: 'sprocket',
    },
  ],
  [
    'Linux/ARM64',
    {
      target: 'aarch64-unknown-linux-gnu',
      extension: 'tar.gz',
      executable: 'sprocket',
    },
  ],
  [
    'macOS/X64',
    {
      target: 'x86_64-apple-darwin',
      extension: 'tar.gz',
      executable: 'sprocket',
    },
  ],
  [
    'macOS/ARM64',
    {
      target: 'aarch64-apple-darwin',
      extension: 'tar.gz',
      executable: 'sprocket',
    },
  ],
  [
    'Windows/X64',
    {
      target: 'x86_64-pc-windows-msvc',
      extension: 'zip',
      executable: 'sprocket.exe',
    },
  ],
  [
    'Windows/ARM64',
    {
      target: 'aarch64-pc-windows-msvc',
      extension: 'zip',
      executable: 'sprocket.exe',
    },
  ],
]);

/**
 * Looks up the platform descriptor for the given `os` / `arch` combination.
 *
 * @throws When Sprocket does not publish binaries for the requested platform.
 */
export function resolvePlatform(os: string, arch: string): Platform {
  const value = PLATFORMS.get(`${os}/${arch}`);
  if (value === undefined) {
    throw new Error(
      `Sprocket does not publish binaries for runner ${os}/${arch}.`,
    );
  }
  return { os, arch, ...value };
}

/** Returns the release-asset filename for the given `version` and `platform`. */
export function assetName(version: string, platform: Platform): string {
  return `sprocket-${version}-${platform.target}.${platform.extension}`;
}
