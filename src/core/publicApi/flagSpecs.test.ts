import { describe, expect, it } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { buildFlagSpecs } from "./flagSpecs.js";

describe("buildFlagSpecs", () => {
  it("maps a flat object schema to kebab-case flag specs", () => {
    const schema = z.object({
      environmentId: z.string().describe("Environment to run in"),
      environmentVariables: z.record(z.string(), z.string()).optional(),
      flowIds: z.array(z.string()).min(1),
      ignoreRules: z.boolean().default(false),
      maxRetries: z.number().optional(),
    });

    const result = buildFlagSpecs(schema);

    expect(result).toEqual({
      ok: true,
      flags: [
        {
          path: ["environmentId"],
          optionKey: "environmentId",
          flag: "--environment-id <value>",
          description: "Environment to run in",
          required: true,
          kind: "string",
        },
        {
          path: ["environmentVariables"],
          optionKey: "environmentVariables",
          flag: "--environment-variables <KEY=VALUE...>",
          description: "",
          required: false,
          kind: "key-value-record",
        },
        {
          path: ["flowIds"],
          optionKey: "flowIds",
          flag: "--flow-ids <values...>",
          description: "",
          required: true,
          kind: "string-array",
        },
        {
          path: ["ignoreRules"],
          optionKey: "ignoreRules",
          flag: "--ignore-rules",
          description: "",
          required: false,
          kind: "boolean",
        },
        {
          path: ["maxRetries"],
          optionKey: "maxRetries",
          flag: "--max-retries <value>",
          description: "",
          required: false,
          kind: "number",
        },
      ],
    });
  });

  it("maps the published run.create contract input", () => {
    const result = buildFlagSpecs(publicContractsV1.run.create.input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.flags.map((spec) => ({
        flag: spec.flag,
        required: spec.required,
      })),
    ).toEqual([
      { flag: "--ai-task-id <value>", required: false },
      { flag: "--chat-session-id <value>", required: false },
      { flag: "--environment-id <value>", required: true },
      { flag: "--environment-variables <KEY=VALUE...>", required: false },
      { flag: "--ignore-rules", required: false },
      { flag: "--pull-request-number <value>", required: false },
      { flag: "--repository <value>", required: false },
      { flag: "--flow-ids <values...>", required: false },
      { flag: "--tag-names <values...>", required: false },
    ]);
  });

  it("merges an intersection of object schemas into one flag set", () => {
    const schema = z
      .object({ environmentId: z.string().describe("Environment id") })
      .and(
        z
          .object({
            flowIds: z.array(z.string()).default([]),
            tagNames: z.array(z.string()).default([]),
          })
          .refine((s) => s.flowIds.length + s.tagNames.length > 0),
      );

    const result = buildFlagSpecs(schema);

    expect(result).toEqual({
      ok: true,
      flags: [
        {
          path: ["environmentId"],
          optionKey: "environmentId",
          flag: "--environment-id <value>",
          description: "Environment id",
          required: true,
          kind: "string",
        },
        {
          path: ["flowIds"],
          optionKey: "flowIds",
          flag: "--flow-ids <values...>",
          description: "",
          required: false,
          kind: "string-array",
        },
        {
          path: ["tagNames"],
          optionKey: "tagNames",
          flag: "--tag-names <values...>",
          description: "",
          required: false,
          kind: "string-array",
        },
      ],
    });
  });

  it("documents an enum field's values when it has no description", () => {
    const schema = z.object({ status: z.enum(["pending", "resolved"]) });

    const result = buildFlagSpecs(schema);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.flags[0]?.description).toBe("One of: pending, resolved");
  });

  it("appends an enum field's values to its description", () => {
    const schema = z.object({
      priority: z.enum(["low", "high"]).describe('Defaults to "low".'),
    });

    const result = buildFlagSpecs(schema);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.flags[0]?.description).toBe(
      'Defaults to "low". One of: low, high',
    );
  });

  it("documents the values of an array-of-enum field", () => {
    const schema = z.object({
      statuses: z.array(z.enum(["pending", "paused"])).describe("Statuses."),
    });

    const result = buildFlagSpecs(schema);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.flags[0]?.description).toBe(
      "Statuses. One of: pending, paused",
    );
  });

  it("documents the published issue.update enum flags", () => {
    const result = buildFlagSpecs(publicContractsV1.issue.update.input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const described = (field: string) =>
      result.flags.find((spec) => spec.path.join(".") === field)?.description;
    expect(described("priority")).toBe(
      "One of: unprioritized, low, medium, high, urgent",
    );
    expect(described("status")).toBe(
      "One of: pending, inProgress, paused, resolved, canceled, archived",
    );
  });

  it("rejects intersections whose members share a field", () => {
    const schema = z
      .object({ name: z.string() })
      .and(z.object({ name: z.string().optional() }));

    const result = buildFlagSpecs(schema);

    expect(result).toEqual({
      ok: false,
      field: "name",
      reason: "field appears in multiple intersection members",
    });
  });

  it("rejects non-object schemas", () => {
    const result = buildFlagSpecs(z.string());

    expect(result).toEqual({
      ok: false,
      field: "",
      reason: "contract input must be an object schema",
    });
  });

  it("rejects arrays of non-strings", () => {
    const schema = z.object({ counts: z.array(z.number()) });

    const result = buildFlagSpecs(schema);

    expect(result).toEqual({
      ok: false,
      field: "counts",
      reason: "only string arrays can be expressed as flags",
    });
  });
});
