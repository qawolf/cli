import { describe, expect, it } from "bun:test";

import { makeCtx } from "~/shell/commandContext.testUtils.js";

import { terminalListView } from "./terminalListView.js";

const atTerminal = makeCtx("human", { isInteractive: true });

describe("terminalListView", () => {
  it("opens the table by default for someone at a terminal", () => {
    expect(terminalListView(undefined, atTerminal).interactive).toBe(true);
  });

  // `docker run -t` without -i, or a script feeding stdin: nobody can answer.
  it("prints by default when stdin is not a terminal", () => {
    const ctx = makeCtx("human", { isInteractive: false });

    expect(terminalListView(undefined, ctx).interactive).toBe(false);
  });

  it("prints by default for an agent or a JSON reader", () => {
    for (const mode of ["agent", "json"] as const) {
      const ctx = makeCtx(mode, { isInteractive: true });

      expect(terminalListView(undefined, ctx).interactive).toBe(false);
    }
  });

  it("prints with --no-interactive, even at a terminal", () => {
    expect(terminalListView(false, atTerminal).interactive).toBe(false);
  });

  // Asked for outright, it is refused later with a reason rather than
  // silently printed.
  it("keeps -i where it cannot work, so it can be refused", () => {
    const ctx = makeCtx("agent", { isInteractive: false });

    expect(terminalListView(true, ctx).interactive).toBe(true);
  });
});
