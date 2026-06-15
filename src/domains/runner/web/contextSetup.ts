import path from "node:path";
import type {
  HarContent,
  HarMode,
  TraceMode,
  VideoMode,
} from "~/core/types.js";
import type { ContextSetupOptions } from "./types.js";

/** Returns the path where Playwright writes the HAR file for a single flow run. */
export function harFlowPath(outputDir: string, flowName: string): string {
  return path.join(outputDir, "har", `${flowName}.har`);
}

/** Returns the path where Playwright writes the trace zip for a single flow run. */
export function traceFlowPath(outputDir: string, flowName: string): string {
  return path.join(outputDir, "trace", `${flowName}.zip`);
}

/**
 * Returns the Playwright `recordHar` context option.
 * Always sets `mode: "minimal"` (captures URL, status, headers, timing; skips
 * response bodies) unless overridden by `harContent: "full"`, which switches
 * `content` to `"embed"` to inline full response bodies.
 *
 * Note: `mode: "minimal"` requires Playwright ≥ 1.23. On older versions,
 * Playwright silently ignores the field and captures full bodies.
 *
 * Note on `"full"` → `"embed"` mapping: Playwright's `content` accepts
 * `"omit" | "embed" | "attach"`. `"embed"` inlines bodies as base64 in the HAR
 * JSON. `"full"` is CLI shorthand for "include bodies" and maps to `"embed"`.
 */
export function buildHarContextOpts(
  harPath: string,
  harContent: HarContent,
): { recordHar: { path: string; mode: "minimal"; content: "omit" | "embed" } } {
  return {
    recordHar: {
      path: harPath,
      mode: "minimal",
      content: harContent === "full" ? "embed" : "omit",
    },
  };
}

/** Resolves harMode and harPath, creating the output directory when needed. */
export async function initHar(
  fs: { mkdir: (p: string, opts?: { recursive?: boolean }) => Promise<void> },
  options: { har?: HarMode; outputDir: string },
  flowName: string,
): Promise<{ harMode: HarMode; harPath: string | undefined }> {
  const harMode = options.har ?? "off";
  if (harMode === "off") return { harMode, harPath: undefined };
  const harPath = harFlowPath(options.outputDir, flowName);
  await fs.mkdir(path.dirname(harPath), { recursive: true });
  return { harMode, harPath };
}

/** Resolves traceMode and tracePath, creating the output directory when needed. */
export async function initTrace(
  fs: { mkdir: (p: string, opts?: { recursive?: boolean }) => Promise<void> },
  options: { trace?: TraceMode; outputDir: string },
  flowName: string,
): Promise<{ traceMode: TraceMode; tracePath: string | undefined }> {
  const traceMode = options.trace ?? "off";
  if (traceMode === "off") return { traceMode, tracePath: undefined };
  const tracePath = traceFlowPath(options.outputDir, flowName);
  await fs.mkdir(path.dirname(tracePath), { recursive: true });
  return { traceMode, tracePath };
}

/**
 * Deletes the trace file when `traceMode` is `"retain-on-failure"` and the flow
 * passed. No-ops for `"on"` and `"off"` modes.
 * Errors from `unlink` are swallowed — cleanup failure must not fail a passing flow.
 */
export async function maybeCleanupTrace(
  fs: { unlink: (p: string) => Promise<void> },
  tracePath: string,
  passed: boolean,
  traceMode: TraceMode,
): Promise<void> {
  if (traceMode !== "retain-on-failure" || !passed) return;
  try {
    await fs.unlink(tracePath);
  } catch {
    // best-effort; do not surface cleanup errors
  }
}

/** Builds the Playwright context setup options for video and HAR recording. */
export function buildContextSetup(
  videoSize: { width: number; height: number },
  options: {
    video: VideoMode;
    artifactDir?: string;
    outputDir: string;
    harContent?: HarContent;
  },
  harPath: string | undefined,
): ContextSetupOptions {
  const videosDir =
    options.artifactDir ?? path.join(options.outputDir, "videos");
  const harOpts =
    harPath !== undefined
      ? buildHarContextOpts(harPath, options.harContent ?? "omit")
      : {};
  return options.video !== "off"
    ? {
        viewport: videoSize,
        screen: videoSize,
        recordVideo: { dir: videosDir, size: videoSize },
        ...harOpts,
      }
    : { viewport: videoSize, screen: videoSize, ...harOpts };
}

/**
 * Deletes the HAR file when `harMode` is `"retain-on-failure"` and the flow
 * passed. No-ops for `"on"` and `"off"` modes.
 * Errors from `unlink` are swallowed — cleanup failure must not fail a passing flow.
 */
export async function maybeCleanupHar(
  fs: { unlink: (p: string) => Promise<void> },
  harPath: string,
  passed: boolean,
  harMode: HarMode,
): Promise<void> {
  if (harMode !== "retain-on-failure" || !passed) return;
  try {
    await fs.unlink(harPath);
  } catch {
    // best-effort; do not surface cleanup errors
  }
}
