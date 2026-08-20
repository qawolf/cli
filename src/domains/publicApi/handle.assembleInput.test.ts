import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { buildFlagSpecs } from "~/core/publicApi/flagSpecs.js";

import { assembleInput } from "./handle.js";

describe("assembleInput", () => {
  it("rebuilds nested input from flattened option keys", () => {
    const contract = {
      name: "fake.reportStatus",
      kind: "write",
      description: "Synthetic nested contract.",
      input: z.object({
        environment: z.union([
          z.strictObject({ id: z.string() }),
          z.strictObject({ name: z.string() }),
        ]),
        externalId: z.string(),
        metadata: z.object({ commitSha: z.string() }).optional(),
      }),
      output: z.object({}),
    };
    const flags = buildFlagSpecs(contract.input);
    if (!flags.ok) throw new Error(flags.reason);

    const assembled = assembleInput(flags.flags, {
      environmentName: "preview-42",
      externalId: "vercel_dpl_123",
      metadataCommitSha: "abc123",
    });

    expect(assembled).toEqual({
      ok: true,
      input: {
        environment: { name: "preview-42" },
        externalId: "vercel_dpl_123",
        metadata: { commitSha: "abc123" },
      },
    });
  });
});
