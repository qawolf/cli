import { mock } from "bun:test";

import { type StyledClack } from "./styledClack.js";

export type MockSpinner = {
  start: ReturnType<typeof mock>;
  message: ReturnType<typeof mock>;
  stop: ReturnType<typeof mock>;
  error: ReturnType<typeof mock>;
};

export type MockTaskLog = {
  message: ReturnType<typeof mock>;
  success: ReturnType<typeof mock>;
  error: ReturnType<typeof mock>;
};

export function makeClack() {
  const isCancel = mock<(value: unknown) => boolean>();
  const createdSpinners: MockSpinner[] = [];
  const createdTaskLogs: MockTaskLog[] = [];
  const clack = {
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
    selectKey: mock(),
    password: mock(),
    isCancel: isCancel as typeof isCancel & StyledClack["isCancel"],
    spinner: mock((): MockSpinner => {
      const s: MockSpinner = {
        start: mock(),
        message: mock(),
        stop: mock(),
        error: mock(),
      };
      createdSpinners.push(s);
      return s;
    }),
    taskLog: mock((_opts: { title: string; limit?: number }) => {
      const tl: MockTaskLog = {
        message: mock(),
        success: mock(),
        error: mock(),
      };
      createdTaskLogs.push(tl);
      return tl;
    }),
  } satisfies StyledClack;
  return { ...clack, createdSpinners, createdTaskLogs };
}
