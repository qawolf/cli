import { describe, expect, it } from "bun:test";

import { flowsMessages } from "~/core/messages/index.js";
import { makeCtx } from "~/shell/commandContext.testUtils.js";
import { exitCodes } from "~/shell/exit.js";

import { unavailableView } from "./listView.js";

describe("unavailableView", () => {
  // A script or an agent cannot answer a prompt; waiting would hang it.
  it("refuses --interactive outside a terminal", () => {
    const ctx = makeCtx("agent");

    expect(unavailableView(ctx, { columns: 80, interactive: true })).toEqual({
      error: flowsMessages.list.interactiveRequiresTerminal,
      exitCode: exitCodes.invalidArgs,
    });
  });

  it("allows --interactive at a terminal", () => {
    const ctx = makeCtx("human", { isInteractive: true });

    expect(
      unavailableView(ctx, { columns: 80, interactive: true }),
    ).toBeUndefined();
  });

  it("has nothing to say about a printed list, in any mode", () => {
    const ctx = makeCtx("json");

    expect(
      unavailableView(ctx, { columns: undefined, interactive: false }),
    ).toBeUndefined();
  });
});
