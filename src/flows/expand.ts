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
const TARGET_POSITIONAL_RE =
  /flow\s*\(\s*["'][^"'\n]*["']\s*,\s*["']([^"'\n]+)["']/;
const TARGET_OBJECT_RE = /\btarget\s*:\s*["']([^"'\n]+)["']/;

export function extractFlowMeta(source: string): {
  name: string | undefined;
  target: string | undefined;
} {
  const name = NAME_RE.exec(source)?.[1];
  const target =
    TARGET_POSITIONAL_RE.exec(source)?.[1] ??
    TARGET_OBJECT_RE.exec(source)?.[1];
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
    // .qawolf does not exist
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
