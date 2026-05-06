import { glob, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { BrowserName } from "~/types.js";

const BROWSERS: BrowserName[] = ["chromium", "firefox", "webkit"];

export function targetToBrowser(target: string): BrowserName | undefined {
  return BROWSERS.includes(target as BrowserName)
    ? (target as BrowserName)
    : undefined;
}

const NAME_RE = /flow\s*\(\s*["']([^"'\n]+)["']/;
// Scoped to the flow() call: matches positional target (group 1) or object-arg target (group 2)
const FLOW_TARGET_RE =
  /flow\s*\(\s*["'][^"'\n]*["']\s*,\s*(?:["']([^"'\n]+)["']|\{[^{}]*\btarget\s*:\s*["']([^"'\n]+)["'])/;

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
  const paths: string[] = [];
  for (const pattern of effectivePatterns) {
    for await (const file of glob(pattern, { cwd: root })) {
      paths.push(resolve(root, file));
    }
  }
  return paths;
}
