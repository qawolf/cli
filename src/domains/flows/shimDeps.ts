// oxlint-disable eslint/max-lines -- readShimMarker helper is colocated with shimFlowsDeps; extracting it would split tightly coupled logic
import { join } from "node:path";

import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import { resolveFromEnvDir } from "~/shell/resolveExport.js";

// Bun binary scoped-package traversal bug (WIZ-10612): when a module inside
// node_modules/@scope/pkg/dist/ imports a bare specifier, Bun stops walking
// at the @scope/ level and never reaches the outer node_modules/.
//
// This affects two classes of deps for @qawolf/flows:
// 1. UNSCOPED direct deps (e.g. expect, pngjs): Bun stops at
//    envDir/node_modules/@qawolf/ and never reaches envDir/node_modules/expect.
// 2. SCOPED direct deps (e.g. @qawolf/flow-targets): the package itself IS
//    found (Bun searches within the stopped scope), but its own unscoped
//    transitive deps (e.g. zod) fail for the same reason — from inside
//    @qawolf/flow-targets/dist/, zod is unreachable.
//
// Shim all @qawolf/flows direct deps at @qawolf/flows/node_modules/<dep>/
// so each bare specifier is found at traversal step 3, before the bug
// triggers. Each shim is a Bun.build() bundle — fully inlined with no bare
// specifier imports — so all transitive deps are covered. Simpler shims (ESM
// re-export, CJS require) fail because Bun propagates the @qawolf/flows
// resolution context to the loaded module, so transitive bare imports still fail.
// In Node.js mode Bun.build() is absent AND Node.js resolves correctly, so
// shimming is skipped entirely. A CJS require() shim for an ESM-only package
// like @qawolf/flow-targets would break named imports in Node.js.

type ShimMarker = { _qawolf_version: string; _qawolf_format: string };

// Uses a structural type instead of `typeof Bun.build` to avoid the
// no-restricted-globals lint rule. Injected in tests — globalThis.Bun is
// read-only in the Bun runtime and cannot be reassigned.
export type BuildFn = (config: {
  entrypoints: string[];
  target?: string;
  format?: string;
}) => Promise<{
  success: boolean;
  outputs: Blob[];
  logs: { message: string }[];
}>;

// Returns the shim marker if shimDir is a qawolf-managed shim, undefined otherwise.
// A directory without the marker is a real package — must not be touched.
function readShimMarker(shimDir: string, fs: Fs): ShimMarker | undefined {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(join(shimDir, "package.json")),
    ) as Partial<ShimMarker>;
    if (pkg._qawolf_format) {
      return {
        _qawolf_version: pkg._qawolf_version ?? "",
        _qawolf_format: pkg._qawolf_format,
      };
    }
  } catch {
    // missing or unreadable — not a managed shim
  }
  return undefined;
}

export async function shimFlowsDeps(
  envDir: string,
  fs: Fs = makeDefaultFs(),
  // undefined = auto-detect from globalThis.Bun; false = Node.js mode (no Bun)
  bunBuild?: BuildFn | false,
): Promise<void> {
  const flowsDir = join(envDir, "node_modules", "@qawolf", "flows");
  if (!fs.existsSync(flowsDir)) return;

  let flowsDeps: string[];
  try {
    const flowsPkg = JSON.parse(
      fs.readFileSync(join(flowsDir, "package.json")),
    ) as { dependencies?: Record<string, string> };
    flowsDeps = Object.keys(flowsPkg.dependencies ?? {});
  } catch {
    return;
  }

  // Access Bun.build via globalThis — works in both the compiled binary (Bun
  // available) and the Node.js CLI build (Bun absent). Uses a structural type
  // instead of `typeof Bun.build` to avoid the no-restricted-globals lint rule.
  // bunBuild is injected in tests (globalThis.Bun is read-only in the runtime).
  const bun =
    bunBuild !== undefined
      ? bunBuild !== false
        ? { build: bunBuild }
        : undefined
      : (globalThis as { Bun?: { build: BuildFn } }).Bun;
  // Node.js resolves bare specifiers correctly; shimming is unnecessary and
  // a CJS require() fallback for ESM-only packages would break named imports.
  // But stale Bun-built CJS shims from a prior binary run must be removed —
  // Node.js finds them first and cannot extract named exports from CJS bundles
  // of ESM-only packages (e.g. @qawolf/flow-targets → getWebBrowserInfo fails).
  if (!bun) {
    const shimsDir = join(flowsDir, "node_modules");
    if (fs.existsSync(shimsDir)) {
      for (const dep of flowsDeps) {
        const shimDepDir = join(shimsDir, ...dep.split("/"));
        if (readShimMarker(shimDepDir, fs)) {
          await fs.rm(shimDepDir, { recursive: true, force: true });
        }
      }
    }
    return;
  }

  for (const dep of flowsDeps) {
    const depParts = dep.split("/"); // ["pkg"] or ["@scope", "pkg"]
    const depDir = join(envDir, "node_modules", ...depParts);
    if (!fs.existsSync(depDir)) continue;

    let depVersion: string;
    try {
      const pkg = JSON.parse(fs.readFileSync(join(depDir, "package.json"))) as {
        version?: string;
      };
      depVersion = pkg.version ?? "unknown";
    } catch {
      depVersion = "unknown";
    }

    const shimDir = join(flowsDir, "node_modules", ...depParts);

    if (fs.existsSync(shimDir)) {
      const marker = readShimMarker(shimDir, fs);
      // No marker means this is a real package directory (e.g. pnpm nested
      // install) — never overwrite or remove it.
      if (!marker) continue;
      if (
        marker._qawolf_version === depVersion &&
        marker._qawolf_format === "bun-build-v1"
      )
        continue;
      // Stale managed shim — remove and rebuild below.
      await fs.rm(shimDir, { recursive: true, force: true });
    }

    let entry: string;
    try {
      entry = resolveFromEnvDir(envDir, dep, "cjs", fs);
    } catch {
      continue;
    }

    const result = await bun.build({
      entrypoints: [entry],
      target: "bun",
      format: "cjs",
    });
    const [output] = result.outputs;
    if (!result.success || !output) {
      const logs = result.logs.map((l) => l.message).join("; ");
      // No logger is threaded into this shimming routine; write the build
      // diagnostic to stderr directly (same channel as the worker error path).
      // oxlint-disable-next-line no-restricted-properties
      process.stderr.write(`[qawolf] bun.build failed for ${dep}: ${logs}\n`);
      continue;
    }
    const shimCode = await output.text();

    await fs.mkdir(shimDir, { recursive: true });
    await fs.writeFile(
      join(shimDir, "package.json"),
      JSON.stringify({
        name: dep,
        _qawolf_version: depVersion,
        _qawolf_format: "bun-build-v1",
      }),
    );
    await fs.writeFile(join(shimDir, "index.js"), shimCode);
  }
}
