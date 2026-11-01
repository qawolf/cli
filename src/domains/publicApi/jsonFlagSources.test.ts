import { describe, expect, it, mock } from "bun:test";
import { z } from "zod";

import { buildFlagSpecs } from "~/core/publicApi/flagSpecs.js";

import { readJsonFlagSources } from "./jsonFlagSources.js";

describe("readJsonFlagSources", () => {
  it("refuses more than one JSON flag reading stdin", async () => {
    const item = z.object({ title: z.string() });
    const specs = buildFlagSpecs(
      z.object({ added: z.array(item), removed: z.array(item) }),
    );
    if (!specs.ok) throw new Error(specs.reason);
    const readStdin = mock(async () => "[]");

    const result = await readJsonFlagSources(
      specs.flags,
      { added: "-", removed: "-" },
      { readFile: mock(async () => "[]"), readStdin },
    );

    expect(result).toEqual({
      ok: false,
      error:
        "Only one flag can read stdin, but --added and --removed are each set to -.",
    });
    expect(readStdin).not.toHaveBeenCalled();
  });
});
