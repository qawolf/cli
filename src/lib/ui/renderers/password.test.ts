import { afterEach, describe, expect, it, mock } from "bun:test";

import { makeClack } from "~/lib/ui/clack/styledClack.mock.js";
import { createPassword } from "./password.js";

describe("createPassword", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("human mode", () => {
    it("returns ok with value when user provides input", async () => {
      const clack = makeClack();
      clack.password.mockResolvedValue("my-secret");
      clack.isCancel.mockReturnValue(false);
      const password = createPassword({ mode: "human", clack });

      const result = await password("Enter API key");

      expect(clack.password).toHaveBeenCalledWith({ message: "Enter API key" });
      expect(result).toEqual({ ok: true, value: "my-secret" });
    });

    it("returns not ok when user cancels", async () => {
      const clack = makeClack();
      clack.password.mockResolvedValue(Symbol("cancel"));
      clack.isCancel.mockReturnValue(true);
      const password = createPassword({ mode: "human", clack });

      const result = await password("Enter API key");

      expect(result).toEqual({ ok: false });
    });
  });

  describe("json mode", () => {
    it("throws with base message when no hint is provided", () => {
      const clack = makeClack();
      const password = createPassword({ mode: "json", clack });

      expect(password("Enter API key")).rejects.toThrow(
        "This command requires an interactive terminal.",
      );
    });

    it("throws with hint when provided", () => {
      const clack = makeClack();
      const password = createPassword({ mode: "json", clack });

      expect(
        password("Enter API key", "Set QAWOLF_API_KEY instead."),
      ).rejects.toThrow(
        "This command requires an interactive terminal. Set QAWOLF_API_KEY instead.",
      );
    });
  });

  describe("agent mode", () => {
    it("throws with hint when provided", () => {
      const clack = makeClack();
      const password = createPassword({ mode: "agent", clack });

      expect(
        password("Enter API key", "Set QAWOLF_API_KEY instead."),
      ).rejects.toThrow(
        "This command requires an interactive terminal. Set QAWOLF_API_KEY instead.",
      );
    });
  });
});
