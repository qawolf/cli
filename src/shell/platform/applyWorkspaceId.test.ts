import { describe, expect, it } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { applyWorkspaceId } from "./applyWorkspaceId.js";

const takesWorkspace = z.object({
  workspaceId: z.string().optional(),
  name: z.string(),
});

const takesEnvironment = z.object({ environmentId: z.string() });

// A union input has no `.shape`, which is what used to make the workspace
// vanish from `issue create` while `tag create` was scoped correctly.
const unionTakesWorkspace = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("bug"),
    name: z.string(),
    workspaceId: z.string().optional(),
  }),
  z.object({
    type: z.literal("coverageRequest"),
    name: z.string(),
    workspaceId: z.string().optional(),
  }),
]);

const unionWithoutWorkspace = z.discriminatedUnion("type", [
  z.object({ type: z.literal("a"), environmentId: z.string() }),
  z.object({ type: z.literal("b"), environmentId: z.string() }),
]);

const intersectionTakesWorkspace = z
  .object({ workspaceId: z.string().optional() })
  .and(z.object({ name: z.string() }));

describe("applyWorkspaceId", () => {
  it("fills in the chosen workspace for a route that takes one", () => {
    const result: unknown = applyWorkspaceId(
      takesWorkspace,
      { name: "a" },
      "ws_1",
    );

    expect(result).toEqual({ name: "a", workspaceId: "ws_1" });
  });

  it("leaves a route that takes no workspace untouched", () => {
    const input = { environmentId: "env_1" };

    expect(applyWorkspaceId(takesEnvironment, input, "ws_1")).toBe(input);
  });

  it("keeps a workspace the caller asked for", () => {
    const input = { name: "a", workspaceId: "ws_explicit" };

    expect(applyWorkspaceId(takesWorkspace, input, "ws_1")).toBe(input);
  });

  it("fills in when the caller passed the key as undefined", () => {
    const result: unknown = applyWorkspaceId(
      takesWorkspace,
      { name: "a", workspaceId: undefined },
      "ws_1",
    );

    expect(result).toEqual({ name: "a", workspaceId: "ws_1" });
  });

  it("changes nothing when no workspace has been chosen", () => {
    const input = { name: "a" };

    expect(applyWorkspaceId(takesWorkspace, input, undefined)).toBe(input);
  });

  it("leaves inputs that are not objects alone", () => {
    expect(applyWorkspaceId(takesWorkspace, "not-an-object", "ws_1")).toBe(
      "not-an-object",
    );
  });
  it("fills in the workspace for a union-shaped contract", () => {
    const result: unknown = applyWorkspaceId(
      unionTakesWorkspace,
      { type: "bug", name: "Broken login" },
      "ws_1",
    );

    expect(result).toEqual({
      type: "bug",
      name: "Broken login",
      workspaceId: "ws_1",
    });
  });

  it("fills in the workspace for an intersection-shaped contract", () => {
    const result: unknown = applyWorkspaceId(
      intersectionTakesWorkspace,
      { name: "a" },
      "ws_1",
    );

    expect(result).toEqual({ name: "a", workspaceId: "ws_1" });
  });

  it("leaves a union that takes no workspace untouched", () => {
    const input = { type: "a" as const, environmentId: "env_1" };

    expect(applyWorkspaceId(unionWithoutWorkspace, input, "ws_1")).toBe(input);
  });

  // Guards the real regression: issue.create is the published contract whose
  // union input silently lost the chosen workspace.
  it("scopes every published contract that declares a workspace", () => {
    const contracts = [
      publicContractsV1.issue.create,
      publicContractsV1.issue.find,
      publicContractsV1.environment.create,
      publicContractsV1.environment.find,
      publicContractsV1.tag.create,
      publicContractsV1.tag.list,
    ];

    for (const contract of contracts) {
      const result = applyWorkspaceId(
        contract.input,
        { type: "bug" },
        "ws_1",
      ) as { workspaceId?: string };

      expect({ name: contract.name, workspaceId: result.workspaceId }).toEqual({
        name: contract.name,
        workspaceId: "ws_1",
      });
    }
  });
});
