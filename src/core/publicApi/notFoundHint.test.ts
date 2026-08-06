import { describe, expect, it } from "bun:test";

import type { FlagSpec } from "./flagSpecs.js";
import { buildNotFoundHint } from "./notFoundHint.js";

const flag = (overrides: Partial<FlagSpec> & { field: string }): FlagSpec => ({
  flag: `--${overrides.field} <value>`,
  description: "",
  required: true,
  kind: "string",
  ...overrides,
});

describe("buildNotFoundHint", () => {
  it("names the resource, flag, and value for a single required id flag", () => {
    const flags = [flag({ field: "issueId", flag: "--issue-id <value>" })];

    expect(buildNotFoundHint(flags, { issueId: "abc123" })).toEqual({
      resource: "issue",
      idFlag: "--issue-id",
      idValue: "abc123",
    });
  });

  it("identifies the id resource even alongside other required flags", () => {
    const flags = [
      flag({ field: "environmentId", flag: "--environment-id <value>" }),
      flag({ field: "name", flag: "--name <value>" }),
      flag({ field: "value", flag: "--value <value>" }),
    ];

    expect(
      buildNotFoundHint(flags, {
        environmentId: "env-1",
        name: "KEY",
        value: "v",
      }),
    ).toEqual({
      resource: "environment",
      idFlag: "--environment-id",
      idValue: "env-1",
    });
  });

  it("returns undefined when no required flag looks like an id", () => {
    const flags = [
      flag({
        field: "flowIds",
        flag: "--flow-ids <values...>",
        kind: "string-array",
      }),
      flag({ field: "tagName", flag: "--tag-name <value>" }),
    ];

    expect(
      buildNotFoundHint(flags, { flowIds: ["f1"], tagName: "t" }),
    ).toBeUndefined();
  });

  it("returns undefined when several required id flags are ambiguous", () => {
    const flags = [
      flag({ field: "issueId", flag: "--issue-id <value>" }),
      flag({ field: "runId", flag: "--run-id <value>" }),
    ];

    expect(
      buildNotFoundHint(flags, { issueId: "i", runId: "r" }),
    ).toBeUndefined();
  });

  it("ignores optional id flags", () => {
    const flags = [
      flag({ field: "workspaceId", required: false }),
      flag({ field: "cursor", required: false }),
    ];

    expect(buildNotFoundHint(flags, { workspaceId: "w" })).toBeUndefined();
  });

  it("returns undefined when the id value is missing or not a string", () => {
    const flags = [flag({ field: "issueId", flag: "--issue-id <value>" })];

    expect(buildNotFoundHint(flags, {})).toBeUndefined();
    expect(buildNotFoundHint(flags, { issueId: "" })).toBeUndefined();
    expect(buildNotFoundHint(flags, { issueId: 42 })).toBeUndefined();
  });
});
