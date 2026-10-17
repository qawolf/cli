import { describe, expect, it } from "bun:test";

import { analyse } from "./analysis.testUtils.js";

const flow = "src/flows/a.flow.ts";

describe("execution scope", () => {
  it.each([
    [
      "a dormant flow helper",
      `function later() { return process.env.NEVER; }
      export default () => process.env.USED;`,
    ],
    [
      "a dormant nested function",
      `export default () => {
      const later = () => process.env.NEVER; return process.env.USED;
    };`,
    ],
    [
      "a dormant class arrow field",
      `class Page {
      later = () => process.env.NEVER;
      used() { return process.env.USED; }
    }
    export default () => new Page().used();`,
    ],
    [
      "an unconstructed class field",
      `class Page { value = process.env.NEVER; }
      export default () => process.env.USED;`,
    ],
    [
      "a function created by a parameter default",
      `function read({ later = () => process.env.NEVER } = {}) { return process.env.USED; }
      export default () => read();`,
    ],
  ])("excludes %s", async (_name, contents) => {
    const result = await analyse({ [flow]: contents });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: ["USED"],
        mayBeIncomplete: false,
      });
    } finally {
      await result.cleanup();
    }
  });

  it.each([
    [
      "an inline callback",
      `export default () => [1].map(() => process.env.TOKEN);`,
    ],
    [
      "a called arrow field",
      `class Page { read = () => process.env.TOKEN; }
      export default () => new Page().read();`,
    ],
    [
      "an immediate function",
      `export default () => (() => process.env.TOKEN)();`,
    ],
    [
      "a static initializer",
      `class Page { static token = process.env.TOKEN; }
      export default () => Page.token;`,
    ],
    [
      "an object parameter binding default",
      `function read({ token = process.env.TOKEN } = {}) { return token; }
      export default () => read({});`,
    ],
    [
      "a nested array parameter binding default",
      `function read({ values: [token = process.env.TOKEN] = [] } = {}) { return token; }
      export default () => read({});`,
    ],
    [
      "a computed parameter binding key",
      `function read({ [process.env.TOKEN]: token } = {}) { return token; }
      export default () => read({});`,
    ],
  ])("includes %s", async (_name, contents) => {
    const result = await analyse({ [flow]: contents });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: ["TOKEN"],
        mayBeIncomplete: false,
      });
    } finally {
      await result.cleanup();
    }
  });
});
