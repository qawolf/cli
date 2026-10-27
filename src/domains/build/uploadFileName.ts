import { basename } from "node:path";

const maxLength = 255;

/**
 * The name `build.requestUpload` accepts for a local file: its base name with
 * every run of other characters turned into `-`, at most 255 characters, with
 * the extension kept. The web app's Builds page names uploads the same way.
 */
export function uploadFileName(filePath: string): string {
  const safe = basename(filePath).replaceAll(/[^A-Za-z0-9._-]+/g, "-");
  if (safe.length <= maxLength) return safe;

  const extension = safe.slice(safe.lastIndexOf("."));
  return safe.slice(0, maxLength - extension.length) + extension;
}
