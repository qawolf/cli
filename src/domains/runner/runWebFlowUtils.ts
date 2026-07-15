import { runnerMessages } from "~/core/messages/index.js";
import { unsupportedSharedDepNames } from "./unsupportedDepNames.js";

export function normalizeBrowserName(
  browser?: "chrome" | "chromium" | "firefox" | "msedge" | "webkit",
): "chromium" | "firefox" | "webkit" {
  if (browser === "chrome" || browser === "msedge") return "chromium";
  if (browser === "firefox") return "firefox";
  if (browser === "webkit") return "webkit";
  return "chromium";
}

export function notSupported(name: string): () => never {
  return () => {
    throw new Error(runnerMessages.notSupportedInCli(name));
  };
}

export const unsupportedWebDepNames = [
  ...unsupportedSharedDepNames,
  "launchElectron",
  "readQRCode",
  "saveBaselineScreenshot",
  "selectors",
  "devices",
] as const;
