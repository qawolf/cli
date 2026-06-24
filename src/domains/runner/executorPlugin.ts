import path from "node:path";

import { type Fs } from "~/shell/fs.js";
import { resolveFromEnvDir } from "~/shell/resolveExport.js";

type BunOnResolveResult = { path: string; external?: boolean } | undefined;

type BunOnLoadResult =
  | { contents: string; loader: "js" | "ts" | "jsx" | "tsx" }
  | undefined;

// Minimal typing for the build context passed to a plugin's setup() function.
type BunPluginBuildCtx = {
  onResolve(
    options: { filter: RegExp },
    callback: (args: { path: string }) => BunOnResolveResult,
  ): void;
  onLoad(
    options: { filter: RegExp },
    callback: (args: {
      path: string;
    }) => Promise<BunOnLoadResult> | BunOnLoadResult,
  ): void;
};

export type BunPlugin = {
  name: string;
  setup(build: BunPluginBuildCtx): void;
};

// Quick detection: does this source file contain any executor package imports?
const executorImportDetect = /from ['"]@qawolf\/(?:flows|testkit|emails)/;

/**
 * Builds a Bun.build plugin that rewrites @qawolf/flows (and subpaths),
 * @qawolf/testkit, and @qawolf/emails imports to their absolute on-disk paths
 * under depsRoot, then marks those absolute paths external so the compiled
 * binary can import them at runtime without inlining their content.
 *
 * The two-step mechanism is required because Bun 1.3.x does not propagate a
 * custom path through onResolve({ external: true }) — it keeps the original
 * bare specifier, which the binary cannot resolve. Instead: (1) onLoad rewrites
 * the import string to an absolute path; (2) onResolve intercepts the resulting
 * absolute-path resolution and marks it external so Bun emits
 * `import X from "/abs/path"` rather than inlining the content.
 */
export function createExternalizeExecutorPlugin(
  depsRoot: string,
  fs: Fs,
): BunPlugin {
  // Populated by onLoad as imports are rewritten; consumed by onResolve.
  const resolvedAbsPaths = new Set<string>();

  return {
    name: "externalize-executor-packages",
    setup(build) {
      // Intercept every TS/JS source load, rewrite executor imports to absolute.
      build.onLoad({ filter: /\.(ts|tsx|js|mjs|cjs)$/ }, async (args) => {
        const source = await fs.readFile(args.path);
        if (!executorImportDetect.test(source)) return undefined;

        const rewritten = source.replace(
          /from\s+['"](@qawolf\/(?:flows|testkit|emails)[^'"]*)['"]/g,
          (_, spec: string) => {
            const absPath = resolveFromEnvDir(depsRoot, spec);
            resolvedAbsPaths.add(absPath);
            return `from ${JSON.stringify(absPath)}`;
          },
        );
        const ext = path.extname(args.path);
        const loader = ext === ".ts" || ext === ".tsx" ? "ts" : "js";
        return { contents: rewritten, loader };
      });

      // Mark absolute executor paths external after onLoad has resolved them.
      build.onResolve({ filter: /^\/.*\.(js|mjs|cjs|ts|tsx)$/ }, (args) => {
        if (!resolvedAbsPaths.has(args.path)) return undefined;
        return { path: args.path, external: true };
      });
    },
  };
}
