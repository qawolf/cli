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
  let archStr: string;
  if (arch === "arm64") {
    archStr = "arm64-v8a";
  } else if (arch === "x64") {
    archStr = "x86_64";
  } else {
    throw new Error(`Unsupported host architecture for Android AVD: ${arch}`);
  }
  // API 36 has no Play Store system image; use google_apis instead.
  const imageType =
    Number(androidVersion) >= 36 ? "google_apis" : "google_apis_playstore";
  return `system-images;android-${androidVersion};${imageType};${archStr}`;
}
