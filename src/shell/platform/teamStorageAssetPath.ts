import { isAbsolute, normalize, sep } from "node:path";

export function safeAssetPath(path: string): string | undefined {
  if (
    !path ||
    path.endsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.includes(":") ||
    isAbsolute(path)
  ) {
    return undefined;
  }

  const segments = path.split("/");
  if (segments.some(isUnsafeSegment)) return undefined;

  const normalized = normalize(path);
  if (normalized.startsWith(`..${sep}`) || normalized === "..") {
    return undefined;
  }
  return normalized;
}

function isUnsafeSegment(segment: string): boolean {
  const normalized = segment.toLowerCase();
  return (
    segment === "" ||
    segment === "." ||
    segment === ".." ||
    normalized === "_screenshots_" ||
    normalized === "screenshots" ||
    normalized === "ovpn" ||
    normalized.endsWith(".ovpn")
  );
}
