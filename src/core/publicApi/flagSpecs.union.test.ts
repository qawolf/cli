import { describe, expect, it } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { buildFlagSpecs } from "./flagSpecs.js";

describe("buildFlagSpecs union inputs", () => {
  it("maps the published issue.create contract input", () => {
    const result = buildFlagSpecs(publicContractsV1.issue.create.input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.flags.map((spec) => ({
        flag: spec.flag,
        required: spec.required,
      })),
    ).toEqual([
      { flag: "--description <value>", required: false },
      { flag: "--name <value>", required: true },
      { flag: "--priority <value>", required: false },
      { flag: "--workspace-id <value>", required: false },
      { flag: "--type <value>", required: true },
      { flag: "--estimated-due-date <value>", required: false },
    ]);
    const type = result.flags.find((spec) => spec.optionKey === "type");
    expect(type?.description).toBe("One of: bug, coverageRequest");
  });

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
          path: ["type"],
          optionKey: "type",
          flag: "--type <value>",
          description: "One of: bug, coverageRequest",
          required: true,
          kind: "string",
        },
        {
          path: ["name"],
          optionKey: "name",
          flag: "--name <value>",
          description: "",
          required: true,
          kind: "string",
        },
        {
          path: ["priority"],
          optionKey: "priority",
          flag: "--priority <value>",
          description: "",
          required: false,
          kind: "string",
        },
        {
          path: ["estimatedDueDate"],
          optionKey: "estimatedDueDate",
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
    const name = result.flags.find((spec) => spec.optionKey === "name");
    expect(name?.required).toBe(false);
  });

  it("maps a union without a shared literal discriminator by exposing every branch's fields", () => {
    const schema = z.union([
      z.object({ flowIds: z.array(z.string()) }),
      z.object({ tagNames: z.array(z.string()) }),
    ]);

    const result = buildFlagSpecs(schema);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.flags.map((spec) => spec.optionKey)).toEqual([
      "flowIds",
      "tagNames",
    ]);
  });

  it("maps a union whose literal values do not distinguish the branches without a discriminator description", () => {
    const schema = z.union([
      z.object({ version: z.literal("v1"), a: z.string() }),
      z.object({ version: z.literal("v1"), b: z.string() }),
    ]);

    const result = buildFlagSpecs(schema);

    expect(result).toEqual({
      ok: true,
      flags: [
        {
          path: ["version"],
          optionKey: "version",
          flag: "--version <value>",
          description: "",
          required: true,
          kind: "string",
        },
        {
          path: ["a"],
          optionKey: "a",
          flag: "--a <value>",
          description: "",
          required: false,
          kind: "string",
        },
        {
          path: ["b"],
          optionKey: "b",
          flag: "--b <value>",
          description: "",
          required: false,
          kind: "string",
        },
      ],
    });
  });

  it("maps a union of object branches that share no discriminator", () => {
    const input = z.object({
      environment: z.union([
        z.strictObject({ id: z.string() }),
        z.strictObject({ name: z.string() }),
      ]),
    });

    const result = buildFlagSpecs(input);

    expect(result).toEqual({
      ok: true,
      flags: [
        {
          path: ["environment", "id"],
          optionKey: "environmentId",
          flag: "--environment-id <value>",
          description: "",
          required: false,
          kind: "string",
        },
        {
          path: ["environment", "name"],
          optionKey: "environmentName",
          flag: "--environment-name <value>",
          description: "",
          required: false,
          kind: "string",
        },
      ],
    });
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
