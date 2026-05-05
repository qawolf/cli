import { mock } from "bun:test";

import { type StyledClack } from "./styledClack.js";

export type MockSpinner = {
  start: ReturnType<typeof mock>;
  message: ReturnType<typeof mock>;
  stop: ReturnType<typeof mock>;
  error: ReturnType<typeof mock>;
};

export function makeClack() {
  const isCancel = mock<(value: unknown) => boolean>();
  const spinnerInstance: MockSpinner = {
    start: mock(),
    message: mock(),
    stop: mock(),
    error: mock(),
  };
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
    spinner: mock(() => spinnerInstance),
  } satisfies StyledClack;
}
