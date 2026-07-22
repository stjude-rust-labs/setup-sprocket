export interface Platform {
  readonly os: string;
  readonly arch: string;
  readonly target: string;
  readonly extension: 'tar.gz' | 'zip';
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

export function resolvePlatform(os: string, arch: string): Platform {
  const value = PLATFORMS.get(`${os}/${arch}`);
  if (value === undefined) {
    throw new Error(
      `Sprocket does not publish binaries for runner ${os}/${arch}.`,
    );
  }
  return { os, arch, ...value };
}

export function assetName(version: string, platform: Platform): string {
  return `sprocket-${version}-${platform.target}.${platform.extension}`;
}
