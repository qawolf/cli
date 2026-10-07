import { expect, it } from "bun:test";

import { analyse } from "./analysis.testUtils.js";

it.each([false, true])(
  "fully propagates recursive reads for every flow (reverse=%s)",
  async (reverse) => {
    const flows: [string, string][] = [
      [
        "src/flows/a.flow.ts",
        `import { a } from "../lib/helpers.js"; export default () => a();`,
      ],
      [
        "src/flows/b.flow.ts",
        `import { b } from "../lib/helpers.js"; export default () => b();`,
      ],
    ];
    const result = await analyse({
      "src/lib/helpers.ts": `export function a(): unknown { return process.env.A ?? b(); }
      export function b(): unknown { return process.env.B ?? a(); }`,
      ...Object.fromEntries(reverse ? flows.toReversed() : flows),
    });
    try {
      expect(result.byFlow.size).toBe(flows.length);
      for (const [path] of flows) {
        expect(result.byFlow.get(path)).toEqual({
          names: ["A", "B"],
          mayBeIncomplete: false,
        });
      }
    } finally {
      await result.cleanup();
    }
  },
);
