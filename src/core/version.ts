type Release = { major: number; minor: number; patch: number };

function parseRelease(version: string): Release | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * True when `latest` is a strictly newer release than `current`. Only plain
 * `major.minor.patch` versions compare; anything else (prereleases, garbage)
 * returns false so callers stay silent rather than mis-notify.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const cur = parseRelease(current);
  const next = parseRelease(latest);
  if (cur === undefined || next === undefined) return false;
  if (next.major !== cur.major) return next.major > cur.major;
  if (next.minor !== cur.minor) return next.minor > cur.minor;
  return next.patch > cur.patch;
}
