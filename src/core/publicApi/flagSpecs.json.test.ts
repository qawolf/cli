import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { buildFlagSpecs } from "./flagSpecs.js";

const changeItem = z.strictObject({
  kind: z.enum(["pull-request", "commit"]),
  title: z.string(),
  description: z.string().optional(),
  url: z.string().optional(),
  changedPaths: z.array(z.string()).optional(),
});

describe("buildFlagSpecs JSON flags", () => {
  it("takes a top-level object holding a list of objects as one JSON flag", () => {
    const input = z.object({
      externalId: z.string(),
      changes: z
        .strictObject({
          items: z.array(changeItem).optional(),
          releaseNotes: z.string().optional(),
          omittedCount: z.number().optional(),
        })
        .describe("What the deployment changed.")
        .optional(),
    });

    const result = buildFlagSpecs(input);

    expect(result.ok && result.flags).toEqual([
      {
        path: ["externalId"],
        optionKey: "externalId",
        flag: "--external-id <value>",
        description: "",
        required: true,
        kind: "string",
      },
      {
        path: ["changes"],
        optionKey: "changes",
        flag: "--changes <json>",
        description: "What the deployment changed.",
        required: false,
        kind: "json",
      },
    ]);
  });

  it("takes a top-level list of objects as one JSON flag", () => {
    const input = z.object({ items: z.array(changeItem) });

    const result = buildFlagSpecs(input);

    expect(result.ok && result.flags).toEqual([
      {
        path: ["items"],
        optionKey: "items",
        flag: "--items <json>",
        description: "",
        required: true,
        kind: "json",
      },
    ]);
  });

  it("takes the whole top-level field as JSON when a deeper leaf does not flatten", () => {
    const input = z.object({
      metadata: z.object({
        commitSha: z.string(),
        details: z.object({ items: z.array(changeItem) }),
      }),
    });

    const result = buildFlagSpecs(input);

    expect(result.ok && result.flags.map((flag) => flag.flag)).toEqual([
      "--metadata <json>",
    ]);
  });

  it("keeps flattening a top-level object whose leaves all fit flags", () => {
    const input = z.object({
      metadata: z.object({ commitSha: z.string() }).optional(),
    });

    const result = buildFlagSpecs(input);

    expect(result.ok && result.flags.map((flag) => flag.flag)).toEqual([
      "--metadata-commit-sha <value>",
    ]);
  });

  it("still rejects a top-level list of non-objects that does not fit a flag", () => {
    const input = z.object({ counts: z.array(z.number()) });

    expect(buildFlagSpecs(input)).toEqual({
      ok: false,
      field: "counts",
      reason: "only string arrays can be expressed as flags",
    });
  });
});
