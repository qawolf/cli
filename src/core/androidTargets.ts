export function makeAvdName(
  deviceModel: string,
  androidVersion: string,
): string {
  return `qawolf_${deviceModel.toLowerCase().replace(/ /g, "_")}_api${androidVersion}`;
}

export function buildSystemImage(
  androidVersion: string,
  arch: NodeJS.Architecture,
): string {
  const archStr = arch === "arm64" ? "arm64-v8a" : "x86_64";
  // API 36 has no Play Store system image; use google_apis instead.
  const imageType =
    Number(androidVersion) >= 36 ? "google_apis" : "google_apis_playstore";
  return `system-images;android-${androidVersion};${imageType};${archStr}`;
}
