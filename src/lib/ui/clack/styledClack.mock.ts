import { mock } from "bun:test";

import { type StyledClack } from "./styledClack.js";

export function makeClack() {
  const isCancel = mock<(value: unknown) => boolean>();
  return {
    log: {
      info: mock(),
      error: mock(),
      step: mock(),
      success: mock(),
      warn: mock(),
    },
    intro: mock(),
    note: mock(),
    outro: mock(),
    cancel: mock(),
    confirm: mock(),
    password: mock(),
    isCancel: isCancel as typeof isCancel & StyledClack["isCancel"],
    spinner: mock(),
  } satisfies StyledClack;
}
