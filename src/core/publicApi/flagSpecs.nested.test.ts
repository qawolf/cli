import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { buildFlagSpecs } from "./flagSpecs.js";

describe("buildFlagSpecs nested inputs", () => {
  it("derives one flag per leaf of a nested object", () => {
    const input = z.object({
      externalId: z.string(),
      metadata: z
        .object({
          commitSha: z.string().describe("The deployed revision."),
          repository: z.string(),
        })
        .optional(),
    });

    const result = buildFlagSpecs(input);

    expect(result.ok).toBe(true);
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
        path: ["metadata", "commitSha"],
        optionKey: "metadataCommitSha",
        flag: "--metadata-commit-sha <value>",
        description: "The deployed revision.",
        required: false,
        kind: "string",
      },
      {
        path: ["metadata", "repository"],
        optionKey: "metadataRepository",
        flag: "--metadata-repository <value>",
        description: "",
        required: false,
        kind: "string",
      },
    ]);
  });

  it("keeps a required leaf optional under an optional parent", () => {
    const input = z.object({
      metadata: z.object({ repository: z.string() }).optional(),
    });

    const result = buildFlagSpecs(input);

    expect(result.ok && result.flags[0]?.required).toBe(false);
  });

  it("keeps a record field a flag rather than walking into it", () => {
    const input = z.object({
      environmentVariables: z.record(z.string(), z.string()),
    });

    const result = buildFlagSpecs(input);

    expect(result.ok && result.flags).toEqual([
      {
        path: ["environmentVariables"],
        optionKey: "environmentVariables",
        flag: "--environment-variables <KEY=VALUE...>",
        description: "",
        required: true,
        kind: "key-value-record",
      },
    ]);
  });

  it("refuses two fields that would produce one flag", () => {
    const input = z.object({
      environment: z.object({ id: z.string() }),
      environmentId: z.string(),
    });

    expect(buildFlagSpecs(input)).toEqual({
      ok: false,
      field: "environmentId",
      reason: "flag --environment-id collides with field environment.id",
    });
  });

  it("refuses two fields of different kinds that kebab to one flag name", () => {
    // flowIds (string-array) and flow.ids (key-value-record) both kebab to
    // --flow-ids, but their full usage strings differ ("<values...>" vs
    // "<KEY=VALUE...>"). Collision detection must key on the bare name, not
    // the full usage string, or Commander sees one option registered twice
    // and throws at program construction instead of this friendly error.
    const input = z.object({
      flowIds: z.array(z.string()),
      flow: z.object({ ids: z.record(z.string(), z.string()) }),
    });

    expect(buildFlagSpecs(input)).toEqual({
      ok: false,
      field: "flow.ids",
      reason: "flag --flow-ids collides with field flowIds",
    });
  });

  it("rejects a nested field whose leaf cannot be expressed as a flag", () => {
    const schema = z.object({
      config: z.object({ counts: z.array(z.number()) }),
    });

    const result = buildFlagSpecs(schema);

    expect(result).toEqual({
      ok: false,
      field: "config.counts",
      reason: "only string arrays can be expressed as flags",
    });
  });
});
