import { afterEach, describe, expect, it, mock } from "bun:test";

import { makeClack } from "~/shell/ui/clack/styledClack.mock.js";
import { createConfirm } from "./confirm.js";

describe("createConfirm", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("benign (arrow-key) in human mode", () => {
    it("returns ok with true when the user confirms", async () => {
      const clack = makeClack();
      clack.confirm.mockResolvedValue(true);
      clack.isCancel.mockReturnValue(false);
      const confirm = createConfirm({ mode: "human", clack });

      const result = await confirm("Are you sure?");

      expect(clack.confirm).toHaveBeenCalledWith({ message: "Are you sure?" });
      expect(clack.selectKey).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: true, value: true });
    });

    it("returns ok with false when the user declines", async () => {
      const clack = makeClack();
      clack.confirm.mockResolvedValue(false);
      clack.isCancel.mockReturnValue(false);
      const confirm = createConfirm({ mode: "human", clack });

      const result = await confirm("Are you sure?");

      expect(result).toEqual({ ok: true, value: false });
    });

    it("returns not ok when the user cancels", async () => {
      const clack = makeClack();
      clack.confirm.mockResolvedValue(Symbol("cancel"));
      clack.isCancel.mockReturnValue(true);
      const confirm = createConfirm({ mode: "human", clack });

      const result = await confirm("Are you sure?");

      expect(result).toEqual({ ok: false });
    });
  });

  describe("destructive (typed y/n) in human mode", () => {
    it("uses selectKey, not the arrow-key confirm", async () => {
      const clack = makeClack();
      clack.selectKey.mockResolvedValue("y");
      clack.isCancel.mockReturnValue(false);
      const confirm = createConfirm({ mode: "human", clack });

      const result = await confirm("Overwrite?", { destructive: true });

      expect(clack.selectKey).toHaveBeenCalledWith({
        message: "Overwrite?",
        caseSensitive: false,
        options: [
          { value: "y", label: "Yes" },
          { value: "n", label: "No" },
        ],
      });
      expect(clack.confirm).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: true, value: true });
    });

    it("returns ok with false when the user picks 'n'", async () => {
      const clack = makeClack();
      clack.selectKey.mockResolvedValue("n");
      clack.isCancel.mockReturnValue(false);
      const confirm = createConfirm({ mode: "human", clack });

      const result = await confirm("Overwrite?", { destructive: true });

      expect(result).toEqual({ ok: true, value: false });
    });

    it("returns not ok when the user cancels", async () => {
      const clack = makeClack();
      clack.selectKey.mockResolvedValue(Symbol("cancel"));
      clack.isCancel.mockReturnValue(true);
      const confirm = createConfirm({ mode: "human", clack });

      const result = await confirm("Overwrite?", { destructive: true });

      expect(result).toEqual({ ok: false });
    });
  });

  describe("yes bypass", () => {
    it("returns true without prompting in any mode", async () => {
      for (const mode of ["human", "json", "agent"] as const) {
        const clack = makeClack();
        const confirm = createConfirm({ mode, clack });

        const result = await confirm("Overwrite?", {
          yes: true,
          destructive: true,
        });

        expect(result).toEqual({ ok: true, value: true });
        expect(clack.confirm).not.toHaveBeenCalled();
        expect(clack.selectKey).not.toHaveBeenCalled();
      }
    });
  });

  describe("non-human modes throw without yes", () => {
    it("throws in json mode", () => {
      const clack = makeClack();
      const confirm = createConfirm({ mode: "json", clack });

      expect(confirm("Are you sure?")).rejects.toThrow(
        "This command requires an interactive terminal. confirm",
      );
    });

    it("throws in agent mode", () => {
      const clack = makeClack();
      const confirm = createConfirm({ mode: "agent", clack });

      expect(confirm("Are you sure?")).rejects.toThrow(
        "This command requires an interactive terminal. confirm",
      );
    });
  });
});
