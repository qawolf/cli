import { getWebBrowserInfo, parseExecutionTarget } from "@qawolf/flow-targets";
import { glob, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { BrowserName } from "~/types.js";

const BROWSER_NAME_TO_PLAYWRIGHT: Record<
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

export function targetToBrowser(target: string): BrowserName | undefined {
  let parsed: ReturnType<typeof parseExecutionTarget>;
  try {
    parsed = parseExecutionTarget(target as ParseExecutionTargetArg);
  } catch {
    return undefined;
  }
  if (parsed.platform !== "web") return undefined;
  const meta = parsed.meta;
  if (typeof meta === "string") return undefined; // "legacy" form
  if (!("defaultBrowser" in meta) && !("browser" in meta)) return undefined; // Electron
  try {
    const info = getWebBrowserInfo(meta);
    return BROWSER_NAME_TO_PLAYWRIGHT[info.name];
  } catch {
    return undefined;
  }
}

// Matches the flow name — the first string literal argument to flow():
//   flow("My Flow", ...)
//        ^^^^^^^^^
const NAME_RE = /\bflow\s*\(\s*["']([^"'\n]+)["']/;

// Matches the browser target, scoped to the flow() call so a `target:` property
// elsewhere in the file (e.g. in a config object) is not captured.
// Two alternatives cover both call signatures:
//
//   Positional — second arg is a string literal (group 1):
//     flow("My Flow", "chromium", async () => { ... })
//                     ^^^^^^^^^
//
//   Object arg — second arg is an options object containing target (group 2):
//     flow("My Flow", { target: "webkit", launch: true }, async () => { ... })
//                               ^^^^^^^^
//
// Dynamic expressions (variables, template literals) produce undefined for that field.
const FLOW_TARGET_RE =
  /\bflow\s*\(\s*["'][^"'\n]*["']\s*,\s*(?:["']([^"'\n]+)["']|\{[^{}]*\btarget\s*:\s*["']([^"'\n]+)["'])/;

export function extractFlowMeta(source: string): {
  name: string | undefined;
  target: string | undefined;
} {
  const name = NAME_RE.exec(source)?.[1];
  const flowTargetMatch = FLOW_TARGET_RE.exec(source);
  const target = flowTargetMatch?.[1] ?? flowTargetMatch?.[2];
  return { name, target };
}

export async function peekFlowMeta(
  filePath: string,
): Promise<{ name: string | undefined; target: string | undefined }> {
  const source = await readFile(filePath, "utf-8");
  return extractFlowMeta(source);
}

async function resolveGlobRoot(cwd: string): Promise<string> {
  const qawolfPath = join(cwd, ".qawolf");
  try {
    const entries = await readdir(qawolfPath, { withFileTypes: true });
    const envDirs = entries.filter((e) => e.isDirectory());
    const [first] = envDirs;
    if (envDirs.length === 1 && first) return join(qawolfPath, first.name);
  } catch {
    // .qawolf dir absent or unreadable
  }
  return cwd;
}

export async function expandPatterns(
  patterns: string[],
  cwd = process.cwd(),
): Promise<string[]> {
  const effectivePatterns = patterns.length > 0 ? patterns : ["**/*.flow.ts"];
  const root = patterns.length > 0 ? cwd : await resolveGlobRoot(cwd);
  const seen = new Set<string>();
  for (const pattern of effectivePatterns) {
    for await (const file of glob(pattern, { cwd: root })) {
      seen.add(resolve(root, file));
    }
  }
  return [...seen];
}
