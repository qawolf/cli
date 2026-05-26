import { join } from "node:path";

import { isNoEntError } from "~/core/errors.js";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";

type ExportsEntry = string | Record<string, unknown> | null;

// pkg.exports can be a path map, a bare string, or a top-level conditions object
type ExportsField =
  | string
  | Record<string, ExportsEntry>
  | Record<string, unknown>
  | null;

function pickPath(
  entry: ExportsEntry | undefined,
  preference: "esm" | "cjs",
): string | undefined {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    const e = entry as {
      import?: ExportsEntry;
      require?: ExportsEntry;
      default?: ExportsEntry;
    };
    const raw =
      preference === "cjs"
        ? (e.require ?? e.default ?? e.import)
        : (e.import ?? e.require ?? e.default);
    return pickPath(raw as ExportsEntry, preference);
  }
  return undefined;
}

// Normalize pkg.exports to a path map keyed by subpath strings ("." / "./sub").
// Handles three formats packages use:
//   string:             "./index.js"                → { ".": "./index.js" }
//   top-level conds:    { "import": "./esm.js" }    → { ".": { "import": "./esm.js" } }
//   path map (normal):  { ".": "./index.js" }       → unchanged
function normalizeExports(
  exports: ExportsField | undefined,
): Record<string, ExportsEntry> | undefined {
  if (exports === undefined || exports === null) return undefined;
  if (typeof exports === "string") return { ".": exports };
  if (typeof exports === "object") {
    const keys = Object.keys(exports);
    if (keys.every((k) => k.startsWith("."))) {
      return exports as Record<string, ExportsEntry>;
    }
    // Top-level condition object — treat as the "." entry
    return { ".": exports as Record<string, unknown> };
  }
  return undefined;
}

// Resolve a bare specifier to an absolute filesystem path by reading the
// package's exports map directly. Avoids module resolution APIs that are
// broken in compiled Bun binaries for ESM-only external packages
// (import.meta.resolve with custom base, createRequire.resolve).
export function resolveFromEnvDir(
  envDir: string,
  specifier: string,
  preference: "esm" | "cjs" = "esm",
  fs: Fs = makeDefaultFs(),
): string {
  const isScoped = specifier.startsWith("@");
  const parts = specifier.split("/");
  const pkgPartCount = isScoped ? 2 : 1;
  const pkgName = parts.slice(0, pkgPartCount).join("/");
  const rest = parts.slice(pkgPartCount);
  const subpath = rest.length > 0 ? "./" + rest.join("/") : ".";

  const pkgDir = join(envDir, "node_modules", ...pkgName.split("/"));
  let pkg: {
    exports?: ExportsField;
    main?: string;
    module?: string;
  };
  try {
    pkg = JSON.parse(
      fs.readFileSync(join(pkgDir, "package.json")),
    ) as typeof pkg;
  } catch (err) {
    if (isNoEntError(err))
      throw new Error(
        `Package '${pkgName}' not found in ${join(envDir, "node_modules")}`,
        { cause: err },
      );
    throw err;
  }

  const exportsMap = normalizeExports(pkg.exports);
  const entry = exportsMap?.[subpath];
  const relative =
    pickPath(entry, preference) ??
    (subpath === "." ? (pkg.module ?? pkg.main) : undefined);

  if (!relative) {
    throw new Error(
      `No entry for "${subpath}" in exports of ${join(pkgDir, "package.json")}`,
    );
  }

  return join(pkgDir, relative);
}
