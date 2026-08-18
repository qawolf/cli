import { getWebBrowserInfo, parseExecutionTarget } from "@qawolf/flow-targets";
import { basename } from "node:path";
import { type FlowCallMeta, parseFlowCall } from "~/core/flowCall.js";
import type { BrowserName } from "~/core/types.js";

export function flowBasename(file: string): string {
  return basename(file).replace(/\.flow\.(ts|js)$/, "");
}

const browserNameToPlaywright: Record<
  "chrome" | "firefox" | "safari",
  BrowserName
> = {
  chrome: "chromium",
  firefox: "firefox",
  safari: "webkit",
};

// `parseExecutionTarget`'s parameter is the strict preset-literal union, but it
// validates `unknown` at runtime via Zod and throws on invalid input. Cast so we
// can hand it any string and rely on the try/catch to handle non-targets.
type ParseExecutionTargetArg = Parameters<typeof parseExecutionTarget>[0];

export function classifyTarget(
  target: string,
):
  | { kind: "web"; browser: BrowserName }
  | { kind: "android" }
  | { kind: "ios" }
  | { kind: "unsupported" }
  | { kind: "unrecognized" } {
  let parsed: ReturnType<typeof parseExecutionTarget>;
  try {
    parsed = parseExecutionTarget(target as ParseExecutionTargetArg);
  } catch {
    // Zod validation failed — not a known target string (e.g. a typo)
    return { kind: "unrecognized" };
  }
  if (parsed.platform === "android") return { kind: "android" };
  if (parsed.platform === "ios") return { kind: "ios" };
  if (parsed.platform !== "web") return { kind: "unsupported" };
  const meta = parsed.meta;
  if (typeof meta === "string") return { kind: "unsupported" }; // "legacy" form
  if (!("defaultBrowser" in meta) && !("browser" in meta))
    return { kind: "unsupported" }; // Electron
  try {
    const info = getWebBrowserInfo(meta);
    const browser = browserNameToPlaywright[info.name];
    if (!browser) return { kind: "unsupported" };
    return { kind: "web", browser };
  } catch {
    return { kind: "unsupported" };
  }
}

export function targetToBrowser(target: string): BrowserName | undefined {
  const c = classifyTarget(target);
  return c?.kind === "web" ? c.browser : undefined;
}

export function isAndroidTarget(target: string): boolean {
  return classifyTarget(target)?.kind === "android";
}

export type PeekFlowMetaFn = (filePath: string) => Promise<FlowCallMeta>;

/**
 * Reads the name and target a flow declares, from either call shape:
 *
 *   flow("My Flow", "chromium", async () => { ... })
 *   flow("My Flow", { target: "webkit", launch: true }, async () => { ... })
 *
 * Either field is undefined when the call does not state it statically.
 */
export function extractFlowMeta(source: string): FlowCallMeta {
  return parseFlowCall(source);
}
