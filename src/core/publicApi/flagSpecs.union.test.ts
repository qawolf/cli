import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { buildFlagSpecs } from "./flagSpecs.js";

describe("buildFlagSpecs union inputs", () => {
  it("maps a discriminated union with a required discriminator flag", () => {
    const schema = z.discriminatedUnion("type", [
      z.object({
        type: z.literal("bug"),
        name: z.string(),
        priority: z.string().optional(),
      }),
      z.object({
        type: z.literal("coverageRequest"),
        name: z.string(),
        priority: z.string().optional(),
        estimatedDueDate: z.string().describe("Due date").optional(),
      }),
    ]);

    const result = buildFlagSpecs(schema);

    expect(result).toEqual({
      ok: true,
      flags: [
        {
          field: "type",
          flag: "--type <value>",
          description: "One of: bug, coverageRequest",
          required: true,
          kind: "string",
        },
        {
          field: "name",
          flag: "--name <value>",
          description: "",
          required: true,
          kind: "string",
        },
        {
          field: "priority",
          flag: "--priority <value>",
          description: "",
          required: false,
          kind: "string",
        },
        {
          field: "estimatedDueDate",
          flag: "--estimated-due-date <value>",
          description: "Due date",
          required: false,
          kind: "string",
        },
      ],
    });
  });

  it("requires a union field only when every branch requires it", () => {
    const schema = z.discriminatedUnion("type", [
      z.object({ type: z.literal("a"), name: z.string() }),
      z.object({ type: z.literal("b"), name: z.string().optional() }),
    ]);

    const result = buildFlagSpecs(schema);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const name = result.flags.find((spec) => spec.field === "name");
    expect(name?.required).toBe(false);
  });

  it("rejects union branches that disagree on a field's flag kind", () => {
    const schema = z.discriminatedUnion("type", [
      z.object({ type: z.literal("a"), value: z.string() }),
      z.object({ type: z.literal("b"), value: z.number() }),
    ]);

    const result = buildFlagSpecs(schema);

    expect(result).toEqual({
      ok: false,
      field: "value",
      reason: "field has conflicting types across union branches",
    });
  });
});
