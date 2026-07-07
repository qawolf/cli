import { describe, expect, it } from "bun:test";

import packageJson from "../../../../package.json" with { type: "json" };
import { checkNodeVersion } from "./nodeVersion.js";

describe("checkNodeVersion", () => {
  it("accepts a supported Node 20 against the shipped engines.node floor", async () => {
    const r = await checkNodeVersion({
      processVersion: "v20.19.0",
      enginesNode: packageJson.engines.node,
    });
    expect(r.status).toBe("pass");
  });

  it("passes at exactly the minor/patch floor", async () => {
    const r = await checkNodeVersion({
      processVersion: "v20.6.0",
      enginesNode: ">=20.6.0",
    });
    expect(r.status).toBe("pass");
  });

  it("fails a same-major version below the minor/patch floor", async () => {
    // Node 20.5.x lacks module.register (20.6+); the flow loader cannot register.
    const r = await checkNodeVersion({
      processVersion: "v20.5.1",
      enginesNode: ">=20.6.0",
    });
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("v20.5.1");
  });

  it("passes when version meets minimum and includes version string", async () => {
    const r = await checkNodeVersion({
      processVersion: "v24.1.0",
      enginesNode: ">=24",
    });
    expect(r).toEqual({
      name: "node-version",
      status: "pass",
      version: "24.1.0",
    });
  });

  it("fails when version is below minimum and includes version string", async () => {
    const r = await checkNodeVersion({
      processVersion: "v18.0.0",
      enginesNode: ">=24",
    });
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("v18.0.0");
    expect(r.version).toBe("18.0.0");
  });

  it("fails when engines.node is not parseable", async () => {
    const r = await checkNodeVersion({
      processVersion: "v24.0.0",
      enginesNode: "wat",
    });
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("wat");
  });
});
