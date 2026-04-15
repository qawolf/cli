import { afterEach, describe, expect, it, vi } from "vitest";

import { makeClack } from "~/lib/ui/clack/styledClack.mock.js";
import { createConfirm } from "./confirm.js";

describe("createConfirm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("returns ok with true when user confirms", async () => {
      const clack = makeClack();
      vi.mocked(clack.confirm).mockResolvedValue(true);
      vi.mocked(clack.isCancel).mockReturnValue(false);
      const confirm = createConfirm({ mode: "human", clack });

      const result = await confirm("Are you sure?");

      expect(clack.confirm).toHaveBeenCalledWith({ message: "Are you sure?" });
      expect(result).toEqual({ ok: true, value: true });
    });

    it("returns ok with false when user declines", async () => {
      const clack = makeClack();
      vi.mocked(clack.confirm).mockResolvedValue(false);
      vi.mocked(clack.isCancel).mockReturnValue(false);
      const confirm = createConfirm({ mode: "human", clack });

      const result = await confirm("Are you sure?");

      expect(result).toEqual({ ok: true, value: false });
    });

    it("returns not ok when user cancels", async () => {
      const clack = makeClack();
      vi.mocked(clack.confirm).mockResolvedValue(Symbol("cancel"));
      vi.mocked(clack.isCancel).mockReturnValue(true);
      const confirm = createConfirm({ mode: "human", clack });

      const result = await confirm("Are you sure?");

      expect(result).toEqual({ ok: false });
    });
  });

  describe("json mode", () => {
    it("throws because interactive input is required", async () => {
      const clack = makeClack();
      const confirm = createConfirm({ mode: "json", clack });

      await expect(confirm("Are you sure?")).rejects.toThrow(
        "This command requires an interactive terminal. confirm",
      );
    });
  });

  describe("agent mode", () => {
    it("throws because interactive input is required", async () => {
      const clack = makeClack();
      const confirm = createConfirm({ mode: "agent", clack });

      await expect(confirm("Are you sure?")).rejects.toThrow(
        "This command requires an interactive terminal. confirm",
      );
    });
  });
});
