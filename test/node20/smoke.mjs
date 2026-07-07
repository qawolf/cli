// Cross-runtime witness that a TypeScript flow module loads and executes on the
// target runtime, driving the REAL shipped loader selection rather than a copy.
//
// loader.generated.mjs is `src/shell/resolver/registerFlowLoader.ts` bundled by
// bun with @oxc-node/core kept external (see the runtime-smoke CI job) — bundling
// resolves the `~/` path alias that Node/oxc cannot. Calling the real
// registerFlowLoader() means this smoke fails if the strategy selection or
// registration regresses, on each of Node 20 / 22 / 24 and Bun.
import { registerFlowLoader } from "./loader.generated.mjs";

await registerFlowLoader();

const mod = await import("./sample.flow.ts");
const name = mod.default?.name;

if (name !== "node20-ok") {
  console.error(`flow-load smoke FAILED: expected "node20-ok", got ${name}`);
  process.exit(1);
}

const runtime =
  globalThis.Bun !== undefined ? "bun" : `node ${process.version}`;
console.log(`flow-load smoke OK on ${runtime}`);
