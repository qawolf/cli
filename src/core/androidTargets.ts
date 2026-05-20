import { parseExecutionTarget } from "@qawolf/flow-targets";

export function makeAvdName(
  deviceModel: string,
  androidVersion: string,
): string {
  return `qawolf_${deviceModel.toLowerCase().replace(/ /g, "_")}_api${androidVersion}`;
}

// `parseExecutionTarget`'s param is the strict preset-literal union, but it
// validates `unknown` at runtime via Zod. Cast so we can hand it any string
// and use the try/catch to reject non-targets.
type ParseArg = Parameters<typeof parseExecutionTarget>[0];

export function avdNameForTarget(target: string): string | undefined {
  let parsed: ReturnType<typeof parseExecutionTarget>;
  try {
    parsed = parseExecutionTarget(target as ParseArg);
  } catch {
    return undefined;
  }
  if (parsed.platform !== "android") return undefined;
  const { deviceModel, androidVersion } = parsed.meta;
  return makeAvdName(deviceModel, androidVersion);
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
