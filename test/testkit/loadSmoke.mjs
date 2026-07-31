// End-to-end witness for WIZ-11313: loading @qawolf/testkit from its absolute
// on-disk path must survive the Node ESM loader on win32, where a raw
// "C:\..." import specifier parses as URL protocol "c:" and is rejected.
// Drives the REAL shipped loader — testkit.generated.mjs is
// `src/shell/testkit.ts` bundled by bun (see the windows-smoke CI job);
// bundling resolves the `~/` path alias that Node cannot.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { configureTestkit } from "./testkit.generated.mjs";

const envDir = await mkdtemp(join(tmpdir(), "qawolf-testkit-smoke-"));
try {
  const pkgDir = join(envDir, "node_modules", "@qawolf", "testkit");
  await mkdir(join(pkgDir, "dist"), { recursive: true });
  await writeFile(
    join(pkgDir, "package.json"),
    JSON.stringify({
      name: "@qawolf/testkit",
      version: "0.0.0-smoke",
      exports: { "./client": "./dist/client.js" },
    }),
  );
  await writeFile(
    join(pkgDir, "dist", "client.js"),
    "export function createTestkitClient(ports) { return { ports }; }\n",
  );
  await writeFile(
    join(pkgDir, "dist", "clientScope.js"),
    "export function configureTestkitClient(client) { globalThis.__qawolfSmokeClient = client; }\n",
  );

  await configureTestkit(envDir);

  if (globalThis.__qawolfSmokeClient === undefined) {
    console.error("testkit load smoke FAILED: client was not registered");
    process.exit(1);
  }
} finally {
  await rm(envDir, { recursive: true, force: true });
}

console.log(`testkit load smoke OK on ${process.platform}`);
