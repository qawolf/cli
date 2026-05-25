import path from "node:path";
import { pathToFileURL } from "node:url";

import { runnerMessages } from "~/core/messages/index.js";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import { resolveFromEnvDir } from "~/shell/resolveExport.js";

// Walk up from flowPath to find the directory that holds node_modules/@qawolf/flows.
function findFlowsEnvDir(
  flowPath: string,
  fs: Fs = makeDefaultFs(),
): string | undefined {
  let dir = path.dirname(flowPath);
  while (true) {
    if (fs.existsSync(path.join(dir, "node_modules", "@qawolf", "flows")))
      return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

// Exported for testing. Replaces @qawolf/flows and @qawolf/flows/* specifiers
// with the URL returned by resolve(specifier). Leaves unresolvable specifiers
// unchanged (resolve is expected to throw on failure).
export function rewriteFlowImports(
  content: string,
  resolve: (specifier: string) => string,
): string {
  return content
    .replace(
      /(from|import)\s+(['"])(@qawolf\/flows(?:\/[^'"]+)?)\2/g,
      (match, keyword: string, quote: string, specifier: string) => {
        try {
          return `${keyword} ${quote}${resolve(specifier)}${quote}`;
        } catch {
          return match;
        }
      },
    )
    .replace(
      /\bimport\s*\(\s*(['"])(@qawolf\/flows(?:\/[^'"]+)?)\1\s*\)/g,
      (match, quote: string, specifier: string) => {
        try {
          return `import(${quote}${resolve(specifier)}${quote})`;
        } catch {
          return match;
        }
      },
    );
}

export async function loadFlowDefault<T>(
  flowPath: string,
  fs: Fs = makeDefaultFs(),
): Promise<T> {
  // process.env.QAWOLF_COMPILED is injected via --define at binary build time
  // (see build:binary in package.json). Undefined in bun run / bun test dev mode.
  const isCompiledBinary = process.env.QAWOLF_COMPILED === "true";

  // Non-compiled path: direct import, no file read needed.
  if (!isCompiledBinary) {
    const mod = (await import(pathToFileURL(flowPath).href)) as Record<
      string,
      unknown
    >;
    const exported = mod["default"] as T | undefined;
    if (exported === undefined)
      throw new Error(runnerMessages.noDefaultExport(flowPath));
    return exported;
  }

  // In compiled Bun binaries, dynamically imported external files cannot resolve
  // bare specifiers — this is a Bun binary limitation separate from the scoped-
  // package traversal bug. Transform @qawolf/flows/* imports to absolute file://
  // paths so Bun loads them directly without any resolution step.
  const content = await fs.readFile(flowPath);
  const envDir = findFlowsEnvDir(flowPath, fs);

  const transformed = envDir
    ? rewriteFlowImports(
        content,
        (specifier) =>
          pathToFileURL(resolveFromEnvDir(envDir, specifier, "esm", fs)).href,
      )
    : content;

  if (transformed === content) {
    const mod = (await import(pathToFileURL(flowPath).href)) as Record<
      string,
      unknown
    >;
    const exported = mod["default"] as T | undefined;
    if (exported === undefined)
      throw new Error(runnerMessages.noDefaultExport(flowPath));
    return exported;
  }

  const annotated = `${transformed}\n//# sourceURL=${pathToFileURL(flowPath).href}`;
  const dataUri = `data:text/javascript,${encodeURIComponent(annotated)}`;
  const mod = (await import(dataUri)) as Record<string, unknown>;
  const exported = mod["default"] as T | undefined;
  if (exported === undefined)
    throw new Error(runnerMessages.noDefaultExport(flowPath));
  return exported;
}
