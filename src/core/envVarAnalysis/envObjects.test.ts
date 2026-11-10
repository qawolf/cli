import { expect, it } from "bun:test";

import { analyse } from "./analysis.testUtils.js";

const flow = "src/flows/a.flow.ts";

it.each([
  "const env = process.env; return env.TOKEN;",
  "return { ...process.env };",
  "return Object.keys(process.env);",
  "function read(env: any) { return env.TOKEN; } return read(process.env);",
])("flags an unhandled environment object in a flow: %s", async (body) => {
  const result = await analyse({ [flow]: `export default () => { ${body} };` });
  try {
    expect(result.byFlow.get(flow)).toEqual({
      names: [],
      mayBeIncomplete: true,
    });
  } finally {
    await result.cleanup();
  }
});
