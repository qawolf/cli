import { describe, expect, it } from "bun:test";

import { analyse } from "./analysis.testUtils.js";

const flow = "src/flows/a.flow.ts";
const reader = `class Reader {
  field = process.env.FIELD;
  constructor(key: string) { console.log(process.env[key]); }
}`;

describe("constructor accessor keys", () => {
  it.each([
    'export default () => new Reader("TOKEN");',
    'function read(key: string) { return new Reader(key); } export default () => read("TOKEN");',
    'class Derived extends Reader {} export default () => new Derived("TOKEN");',
    `class Derived extends Reader {
      constructor(key: string) { super(key); }
    } export default () => new Derived("TOKEN");`,
  ])("resolves constructor keys with instance reads: %s", async (source) => {
    const result = await analyse({ [flow]: `${reader} ${source}` });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: ["FIELD", "TOKEN"],
        mayBeIncomplete: false,
      });
    } finally {
      await result.cleanup();
    }
  });

  it("forwards keys to an overloaded constructor", async () => {
    const result = await analyse({
      [flow]: `class Reader {
        field = process.env.FIELD;
        constructor(key: string);
        constructor(key: string) { console.log(process.env[key]); }
      }
      function read(key: string) { return new Reader(key); }
      export default () => read("TOKEN");`,
    });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: ["FIELD", "TOKEN"],
        mayBeIncomplete: false,
      });
    } finally {
      await result.cleanup();
    }
  });

  it("resolves every constructor key slot", async () => {
    const result = await analyse({
      [flow]: `class Reader {
        constructor(first: string, second: string) {
          console.log(process.env[first], process.env[second]);
        }
      } export default () => new Reader("FIRST", "SECOND");`,
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
});
