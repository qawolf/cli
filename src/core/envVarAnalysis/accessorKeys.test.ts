import { describe, expect, it } from "bun:test";

import { analyse } from "./analysis.testUtils.js";

const flow = "src/flows/a.flow.ts";

describe("accessor keys", () => {
  it.each([
    `function read(first: string, second: string) {
      return process.env[first] + process.env[second];
    }`,
    `function env(key: string) { return process.env[key]; }
    function read(first: string, second: string) {
      return env(first) + env(second);
    }`,
    `function read(first: string, second: string): unknown {
      return next(first, second);
    }
    function next(first: string, second: string): unknown {
      return process.env[first] ?? process.env[second] ?? read(first, second);
    }`,
  ])("resolves every key slot through calls: %s", async (helper) => {
    const result = await analyse({
      [flow]: `${helper} export default () => read("FIRST", "SECOND");`,
    });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: ["FIRST", "SECOND"],
        mayBeIncomplete: false,
      });
    } finally {
      await result.cleanup();
    }
  });

  it("accepts literal names containing template markers", async () => {
    const result = await analyse({
      [flow]:
        "function env(key: string) { return process.env[key]; }\n" +
        'export default () => [env("TOKEN${SUFFIX}"), env(`LITERAL\\${KEY}`)];',
    });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: ["LITERAL${KEY}", "TOKEN${SUFFIX}"],
        mayBeIncomplete: false,
      });
    } finally {
      await result.cleanup();
    }
  });

  it("keeps interpolated key expressions incomplete", async () => {
    const result = await analyse({
      [flow]:
        "function env(key: string) { return process.env[key]; }\n" +
        "export default (suffix: string) => env(`TOKEN${suffix}`);",
    });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: [],
        mayBeIncomplete: true,
      });
    } finally {
      await result.cleanup();
    }
  });
});
