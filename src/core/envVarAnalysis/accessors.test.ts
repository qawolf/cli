import { describe, expect, it } from "bun:test";

import { analyse } from "./analysis.testUtils.js";

const flow = "src/flows/a.flow.ts";

const envHelper = `export function readEnv(name: string) { return process.env[name]; }
  export function requireEnv(name: string) {
    const value = readEnv(name);
    if (!value) throw new Error("missing " + name);
    return value;
  }`;

describe("env accessors", () => {
  it("takes the variable name from the call site", async () => {
    const r = await analyse({
      "src/lib/env.ts": envHelper,
      [flow]: `import { requireEnv } from "../lib/env.js";
        export default async () => requireEnv("ADMIN_TOKEN");`,
    });
    expect(r.byFlow.get(flow)).toEqual({
      names: ["ADMIN_TOKEN"],
      mayBeIncomplete: false,
    });
    await r.cleanup();
  });

  it("follows a forwarding chain to find the accessor", async () => {
    const r = await analyse({
      "src/lib/env.ts": envHelper,
      [flow]: "export default async () => 1;",
    });
    expect(r.accessorCount).toBe(2);
    await r.cleanup();
  });

  it("does not flag a flow as incomplete for using the helper", async () => {
    const r = await analyse({
      "src/lib/env.ts": envHelper,
      [flow]: `import { requireEnv } from "../lib/env.js";
        export default async () => requireEnv("A") + requireEnv("B");`,
    });
    expect(r.byFlow.get(flow)).toEqual({
      names: ["A", "B"],
      mayBeIncomplete: false,
    });
    await r.cleanup();
  });

  it("reaches accessor calls made inside a page object", async () => {
    const r = await analyse({
      "src/lib/env.ts": envHelper,
      "src/pages/p.ts": `import { requireEnv } from "../lib/env.js";
        export class P { login() { return requireEnv("PAGE_TOKEN"); } }`,
      [flow]: `import { P } from "../pages/p.js";
        export default async () => new P().login();`,
    });
    expect(r.byFlow.get(flow)?.names).toEqual(["PAGE_TOKEN"]);
    await r.cleanup();
  });

  it("flags an accessor called with a non-literal", async () => {
    const r = await analyse({
      "src/lib/env.ts": envHelper,
      [flow]: `import { requireEnv } from "../lib/env.js";
        export default async (which: string) => requireEnv(which);`,
    });
    expect(r.byFlow.get(flow)).toEqual({ names: [], mayBeIncomplete: true });
    await r.cleanup();
  });

  it("resolves literals and flags variables in the same flow", async () => {
    const r = await analyse({
      "src/lib/env.ts": envHelper,
      [flow]: `import { requireEnv } from "../lib/env.js";
        export default async (which: string) =>
          requireEnv("KNOWN") + requireEnv(which);`,
    });
    expect(r.byFlow.get(flow)).toEqual({
      names: ["KNOWN"],
      mayBeIncomplete: true,
    });
    await r.cleanup();
  });

  it("handles an accessor whose key is not the first parameter", async () => {
    const r = await analyse({
      "src/lib/env.ts": `export function get(fallback: string, name: string) {
          return process.env[name] ?? fallback;
        }`,
      [flow]: `import { get } from "../lib/env.js";
        export default async () => get("none", "SECOND_SLOT");`,
    });
    expect(r.byFlow.get(flow)?.names).toEqual(["SECOND_SLOT"]);
    await r.cleanup();
  });

  it("finds no accessors in a repo that reads process.env directly", async () => {
    const r = await analyse({
      [flow]: `export default async () => process.env.DIRECT;`,
    });
    expect(r.accessorCount).toBe(0);
    expect(r.byFlow.get(flow)?.names).toEqual(["DIRECT"]);
    await r.cleanup();
  });
});
