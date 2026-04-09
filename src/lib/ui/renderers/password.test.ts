import { afterEach, describe, expect, it, vi } from "vitest";

import { type StyledClack } from "../clack/index.js";
import { createPassword } from "./password.js";

function makeClack(): StyledClack {
  return {
    log: {
      info: vi.fn(),
      error: vi.fn(),
      step: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
    },
    intro: vi.fn(),
    note: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    password: vi.fn(),
    isCancel: vi.fn(),
    spinner: vi.fn(),
  } as unknown as StyledClack;
}

describe("createPassword", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("returns ok with value when user provides input", async () => {
      const clack = makeClack();
      vi.mocked(clack.password).mockResolvedValue("my-secret");
      vi.mocked(clack.isCancel).mockReturnValue(false);
      const password = createPassword({ mode: "human", clack });

      const result = await password("Enter API key");

      expect(clack.password).toHaveBeenCalledWith({ message: "Enter API key" });
      expect(result).toEqual({ ok: true, value: "my-secret" });
    });

    it("returns not ok when user cancels", async () => {
      const clack = makeClack();
      vi.mocked(clack.password).mockResolvedValue(Symbol("cancel"));
      vi.mocked(clack.isCancel).mockReturnValue(true);
      const password = createPassword({ mode: "human", clack });

      const result = await password("Enter API key");

      expect(result).toEqual({ ok: false });
    });
  });

  describe("json mode", () => {
    it("throws because interactive input is required", async () => {
      const clack = makeClack();
      const password = createPassword({ mode: "json", clack });

      await expect(password("Enter API key")).rejects.toThrow(
        "ctx.password() requires human mode (current: json)",
      );
    });
  });

  describe("agent mode", () => {
    it("throws because interactive input is required", async () => {
      const clack = makeClack();
      const password = createPassword({ mode: "agent", clack });

      await expect(password("Enter API key")).rejects.toThrow(
        "ctx.password() requires human mode (current: agent)",
      );
    });
  });
});
