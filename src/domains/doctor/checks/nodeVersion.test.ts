import { describe, expect, it } from "bun:test";

import { checkNodeVersion } from "./nodeVersion.js";

describe("checkNodeVersion", () => {
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
