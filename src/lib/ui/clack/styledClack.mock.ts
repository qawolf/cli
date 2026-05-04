import { vi } from "vitest";

import { type StyledClack } from "./styledClack.js";

export function makeClack() {
  const isCancel = vi.fn<(value: unknown) => boolean>();
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
    confirm: vi.fn(),
    password: vi.fn(),
    isCancel: isCancel as typeof isCancel & StyledClack["isCancel"],
    spinner: vi.fn(),
  } satisfies StyledClack;
}
