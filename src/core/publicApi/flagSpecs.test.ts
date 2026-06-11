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
          field: "environmentId",
          flag: "--environment-id <value>",
          description: "Environment to run in",
          required: true,
          kind: "string",
        },
        {
          field: "environmentVariables",
          flag: "--environment-variables <KEY=VALUE...>",
          description: "",
          required: false,
          kind: "key-value-record",
        },
        {
          field: "flowIds",
          flag: "--flow-ids <values...>",
          description: "",
          required: true,
          kind: "string-array",
        },
        {
          field: "ignoreRules",
          flag: "--ignore-rules",
          description: "",
          required: false,
          kind: "boolean",
        },
        {
          field: "maxRetries",
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
    expect(result.flags.map((spec) => spec.flag)).toEqual([
      "--environment-id <value>",
      "--environment-variables <KEY=VALUE...>",
      "--flow-ids <values...>",
      "--ignore-rules",
    ]);
    expect(
      result.flags.map((spec) => ({
        field: spec.field,
        required: spec.required,
      })),
    ).toEqual([
      { field: "environmentId", required: true },
      { field: "environmentVariables", required: false },
      { field: "flowIds", required: true },
      { field: "ignoreRules", required: false },
    ]);
  });

  it("rejects nested object fields", () => {
    const schema = z.object({
      config: z.object({ nested: z.string() }),
    });

    const result = buildFlagSpecs(schema);

    expect(result).toEqual({
      ok: false,
      field: "config",
      reason: "nested objects cannot be expressed as flags",
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
