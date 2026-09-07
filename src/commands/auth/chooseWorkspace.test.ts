import { describe, expect, it, mock } from "bun:test";

import { authMessages } from "~/core/messages/index.js";
import type { SelectWorkspaceResult } from "~/domains/auth/selectWorkspace.js";
import type { CommandContext } from "~/shell/commandContext.js";
import type { UI } from "~/shell/ui/types.js";
import { reportWorkspace } from "./chooseWorkspace.js";

function makeCtx(mode: UI["mode"]): CommandContext & { ui: UI } {
  return {
    ui: {
      mode,
      info: mock(),
      warn: mock(),
      error: mock(),
    } as unknown as UI,
  } as unknown as CommandContext & { ui: UI };
}

const cancelled: SelectWorkspaceResult = { outcome: "cancelled" };

describe("reportWorkspace", () => {
  it("treats a dismissed prompt as the person's choice", () => {
    const ctx = makeCtx("human");

    expect(reportWorkspace(ctx, cancelled)).toBeUndefined();
    expect(ctx.ui.info).toHaveBeenCalledWith(authMessages.workspace.cancelled);
  });

  // Nothing was cancelled here — there was no prompt to dismiss. Reporting
  // success would leave a CI job working in the previous workspace.
  it("fails a non-interactive run that settled on nothing", () => {
    const ctx = makeCtx("json");

    expect(reportWorkspace(ctx, cancelled)).toEqual({
      error: authMessages.workspace.nonInteractive,
    });
    // Returned only: the command wrapper renders it, so printing it here as
    // well showed it twice.
    expect(ctx.ui.error).not.toHaveBeenCalled();
    expect(ctx.ui.info).not.toHaveBeenCalled();
  });

  it("passes a failure through with its message", () => {
    const ctx = makeCtx("human");

    expect(
      reportWorkspace(ctx, { outcome: "failed", error: "no such workspace" }),
    ).toEqual({ error: "no such workspace" });
    expect(ctx.ui.warn).not.toHaveBeenCalled();
  });

  it("reports a successful choice without failing", () => {
    const ctx = makeCtx("human");
    const result: SelectWorkspaceResult = {
      outcome: "selected",
      organization: {
        id: "qw_1",
        name: "Acme",
        workOsOrganizationId: "org_1",
        workspaces: [],
      },
      workspace: { id: "ws_1", name: "Main", slug: "main" },
    };

    expect(reportWorkspace(ctx, result)).toBeUndefined();
    expect(ctx.ui.info).toHaveBeenCalledWith(
      authMessages.workspace.working("Acme", "Main"),
    );
  });
});
