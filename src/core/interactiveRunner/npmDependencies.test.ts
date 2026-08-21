import { describe, expect, it } from "bun:test";

import { readNpmDependencies } from "./npmDependencies.js";

const read = (manifest: unknown) =>
  readNpmDependencies(JSON.stringify(manifest));

describe("readNpmDependencies", () => {
  it("reads both dependency sections into one record", () => {
    expect(
      read({
        dependencies: { dayjs: "1.11.13" },
        devDependencies: { typescript: "6.0.3" },
      }),
    ).toEqual({
      dependencies: { dayjs: "1.11.13", typescript: "6.0.3" },
      ok: true,
    });
  });

  // The server resolves a run the same way, so an install has to agree with it.
  it("takes dependencies over devDependencies for a name in both", () => {
    expect(
      read({
        dependencies: { dayjs: "1.11.13" },
        devDependencies: { dayjs: "1.0.0" },
      }),
    ).toEqual({ dependencies: { dayjs: "1.11.13" }, ok: true });
  });

  // A runner cannot install one, and @qawolf/flows is already on it.
  it("drops a workspace range", () => {
    expect(
      read({
        dependencies: { "@qawolf/flows": "workspace:*", dayjs: "1.11.13" },
      }),
    ).toEqual({ dependencies: { dayjs: "1.11.13" }, ok: true });
  });

  it("reads a manifest declaring nothing as declaring nothing", () => {
    expect(read({ name: "project" })).toEqual({ dependencies: {}, ok: true });
  });

  it("ignores sections it does not install from", () => {
    expect(
      read({
        dependencies: { dayjs: "1.11.13" },
        optionalDependencies: { sharp: "0.34.0" },
        peerDependencies: { zod: "4.4.3" },
      }),
    ).toEqual({ dependencies: { dayjs: "1.11.13" }, ok: true });
  });

  it("names what is wrong with a manifest it cannot read", () => {
    expect(readNpmDependencies("{ not json")).toEqual({
      ok: false,
      reason: "it is not valid JSON",
    });
    expect(readNpmDependencies("[]")).toEqual({
      ok: false,
      reason: "it is not an object",
    });
    expect(read({ dependencies: "dayjs" })).toEqual({
      ok: false,
      reason: "dependencies is not an object",
    });
    expect(read({ dependencies: { dayjs: 1 } })).toEqual({
      ok: false,
      reason: "dependencies.dayjs is not a string",
    });
  });
});
