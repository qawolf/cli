import { describe, expect, it } from "bun:test";

import { analyse } from "./analysis.testUtils.js";

const flow = "src/flows/a.flow.ts";
const decorator = `function decorate(value: unknown) {
  return (...args: unknown[]) => {};
}`;

describe("decorator execution", () => {
  it.each([
    "@decorate(process.env.TOKEN) class Example {}",
    "class Example { @decorate(process.env.TOKEN) method() {} }",
    "class Example { @decorate(process.env.TOKEN) field = 1; }",
  ])("includes a decorator argument: %s", async (source) => {
    const result = await analyse({
      [flow]: `${decorator} ${source} export default () => 1;`,
    });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: ["TOKEN"],
        mayBeIncomplete: false,
      });
    } finally {
      await result.cleanup();
    }
  });

  it("flags a dynamic decorator argument", async () => {
    const result = await analyse({
      [flow]: `${decorator}
        declare const key: string;
        class Example { @decorate(process.env[key]) field = 1; }
        export default () => 1;`,
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
