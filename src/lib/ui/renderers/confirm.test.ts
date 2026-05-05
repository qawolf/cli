import { afterEach, describe, expect, it, mock } from "bun:test";

import { makeClack } from "~/lib/ui/clack/styledClack.mock.js";
import { createConfirm } from "./confirm.js";

describe("createConfirm", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("human mode", () => {
    it("returns ok with true when user confirms", async () => {
      const clack = makeClack();
      clack.confirm.mockResolvedValue(true);
      clack.isCancel.mockReturnValue(false);
      const confirm = createConfirm({ mode: "human", clack });

      const result = await confirm("Are you sure?");

      expect(clack.confirm).toHaveBeenCalledWith({ message: "Are you sure?" });
      expect(result).toEqual({ ok: true, value: true });
    });

    it("returns ok with false when user declines", async () => {
      const clack = makeClack();
      clack.confirm.mockResolvedValue(false);
      clack.isCancel.mockReturnValue(false);
      const confirm = createConfirm({ mode: "human", clack });

      const result = await confirm("Are you sure?");

      expect(result).toEqual({ ok: true, value: false });
    });

    it("returns not ok when user cancels", async () => {
      const clack = makeClack();
      clack.confirm.mockResolvedValue(Symbol("cancel"));
      clack.isCancel.mockReturnValue(true);
      const confirm = createConfirm({ mode: "human", clack });

      const result = await confirm("Are you sure?");

      expect(result).toEqual({ ok: false });
    });
  });

  describe("json mode", () => {
    it("throws because interactive input is required", () => {
      const clack = makeClack();
      const confirm = createConfirm({ mode: "json", clack });

      expect(confirm("Are you sure?")).rejects.toThrow(
        "This command requires an interactive terminal. confirm",
      );
    });
  });

  describe("agent mode", () => {
    it("throws because interactive input is required", () => {
      const clack = makeClack();
      const confirm = createConfirm({ mode: "agent", clack });

      expect(confirm("Are you sure?")).rejects.toThrow(
        "This command requires an interactive terminal. confirm",
      );
    });
  });
});
