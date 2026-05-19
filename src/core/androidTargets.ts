export function makeAvdName(
  deviceModel: string,
  androidVersion: string,
): string {
  return `qawolf_${deviceModel.toLowerCase().replace(/ /g, "_")}_api${androidVersion}`;
}

const avdArchByNodeArch: Partial<Record<NodeJS.Architecture, string>> = {
  arm64: "arm64-v8a",
  x64: "x86_64",
};

export function buildSystemImage(
  androidVersion: string,
  arch: NodeJS.Architecture,
): string {
  const archStr = avdArchByNodeArch[arch];
  if (!archStr) {
    throw new Error(`Unsupported host architecture for Android AVD: ${arch}`);
  }
  // API 36 has no Play Store system image; use google_apis instead.
  const imageType =
    Number(androidVersion) >= 36 ? "google_apis" : "google_apis_playstore";
  return `system-images;android-${androidVersion};${imageType};${archStr}`;
}
