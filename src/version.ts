const MINIMUM_VERSION = [0, 8, 0] as const;
const VERSION_PATTERN = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function isLatest(input: string): boolean {
  return input.trim().toLowerCase() === 'latest';
}

export function normalizeVersion(input: string): string {
  const value = input.trim();
  const match = VERSION_PATTERN.exec(value);
  if (match === null) {
    throw new Error(
      `Expected an exact semantic version such as 0.28.0 or v0.28.0; received ${JSON.stringify(value)}.`,
    );
  }

  const version = match.slice(1).map(Number) as [number, number, number];
  if (compare(version, MINIMUM_VERSION) < 0) {
    throw new Error(
      `Sprocket v${version.join('.')} is unsupported; binary releases begin at v0.8.0.`,
    );
  }

  return `v${version.join('.')}`;
}

function compare(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}
