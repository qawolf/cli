import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { applyWorkspaceId } from "./applyWorkspaceId.js";

const takesWorkspace = z.object({
  workspaceId: z.string().optional(),
  name: z.string(),
});

const takesEnvironment = z.object({ environmentId: z.string() });

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
});
