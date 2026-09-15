import { describe, expect, it } from "bun:test";

import { analyse } from "./analysis.testUtils.js";

const flow = "src/flows/a.flow.ts";

describe("callable execution", () => {
  it.each([
    [
      "an overload implementation",
      `export function read(x: string): string;
      export function read(x: number): string;
      export function read(x: string | number) { return process.env.TOKEN || String(x); }`,
      `import { read } from "../lib/helpers.js"; export default () => read("x");`,
    ],
    [
      "a getter",
      `export class Page { get token() { return process.env.TOKEN; } }`,
      `import { Page } from "../lib/helpers.js"; export default () => new Page().token;`,
    ],
    [
      "a getter read with a literal key",
      `export const page = { get token() { return process.env.TOKEN; } };`,
      `import { page } from "../lib/helpers.js"; export default () => page["token"];`,
    ],
    [
      "a function returned by an invoked getter",
      `export class Page { get callback() { return () => process.env.TOKEN; } }`,
      `import { Page } from "../lib/helpers.js"; export default () => new Page().callback();`,
    ],
    [
      "the run callback of a default flow definition",
      `export function unused() { return process.env.NEVER; }`,
      `export default { name: "flow", run: async () => process.env.TOKEN,
        unused: () => process.env.NEVER };`,
    ],
    [
      "the referenced run callback of a re-exported flow definition",
      `function run() { return process.env.TOKEN; }
        export const definition = { name: "flow", run, unused: () => process.env.NEVER };`,
      `export { definition as default } from "../lib/helpers.js";`,
    ],
    [
      "a referenced callback",
      `export function read() { return process.env.TOKEN; }`,
      `import { read } from "../lib/helpers.js"; export default () => [1].map(read);`,
    ],
    [
      "a re-exported entrypoint",
      `export function read() { return process.env.TOKEN; }`,
      `export { read as default } from "../lib/helpers.js";`,
    ],
    [
      "a referenced default entrypoint",
      `export function read() { return process.env.TOKEN; }`,
      `import { read } from "../lib/helpers.js"; export default read;`,
    ],
    [
      "a callback passed to flow registration",
      `export function read() { return process.env.TOKEN; }`,
      `import { read } from "../lib/helpers.js";
        import { flow } from "@qawolf/flows"; flow("name", "chromium", read);`,
    ],
  ])("includes %s", async (_name, helper, contents) => {
    const result = await analyse({
      "src/lib/helpers.ts": helper,
      [flow]: contents,
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

  it.each([
    `export default (read: () => string) => read();`,
    `export default (page: any) => page.read();`,
  ])("flags an unresolved local call: %s", async (contents) => {
    const result = await analyse({
      [flow]: contents,
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
