import { getWebBrowserInfo, parseExecutionTarget } from "@qawolf/flow-targets";
import { glob, readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { BrowserName } from "~/types.js";

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
    return browserNameToPlaywright[info.name];
  } catch {
    return undefined;
  }
}

// Matches the flow name — the first string literal argument to flow():
//   flow("My Flow", ...)
//        ^^^^^^^^^
const nameRe = /\bflow\s*\(\s*["']([^"'\n]+)["']/;

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
const flowTargetRe =
  /\bflow\s*\(\s*["'][^"'\n]*["']\s*,\s*(?:["']([^"'\n]+)["']|\{[^{}]*\btarget\s*:\s*["']([^"'\n]+)["'])/;

export function extractFlowMeta(source: string): {
  name: string | undefined;
  target: string | undefined;
} {
  const name = nameRe.exec(source)?.[1];
  const flowTargetMatch = flowTargetRe.exec(source);
  const target = flowTargetMatch?.[1] ?? flowTargetMatch?.[2];
  return { name, target };
}

export async function peekFlowMeta(
  filePath: string,
): Promise<{ name: string | undefined; target: string | undefined }> {
  const source = await readFile(filePath, "utf-8");
  return extractFlowMeta(source);
}

// Globs run from cwd *and* from each `.qawolf/<env>/` subdir. The env-dir
// roots are what makes a freshly-pulled `.qawolf/<env>/src/flows/...` layout
// discoverable, since Node's `glob` doesn't expand `**` into dotted dirs.
// Keeping cwd as a root preserves cwd-relative patterns like
// `.qawolf/<env>/src/flows/**/*.flow.js` (Node's glob *does* match literal
// dotted segments in a pattern — only the `**` wildcard skips them) and
// project-local flows alongside pulled ones. Duplicates are merged on
// absolute path downstream.
async function resolveGlobRoots(cwd: string): Promise<string[]> {
  const qawolfPath = join(cwd, ".qawolf");
  let envDirs: string[] = [];
  try {
    const entries = await readdir(qawolfPath, { withFileTypes: true });
    envDirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => join(qawolfPath, e.name));
  } catch {
    // .qawolf dir absent or unreadable
  }
  return [cwd, ...envDirs];
}

export async function expandPatterns(
  patterns: string[],
  cwd = process.cwd(),
): Promise<string[]> {
  const effectivePatterns =
    patterns.length > 0 ? patterns : ["**/*.flow.{ts,js}"];
  const roots = await resolveGlobRoots(cwd);
  const seen = new Set<string>();
  for (const root of roots) {
    for (const pattern of effectivePatterns) {
      for await (const file of glob(pattern, { cwd: root })) {
        seen.add(resolve(root, file));
      }
    }
  }
  return [...seen];
}
