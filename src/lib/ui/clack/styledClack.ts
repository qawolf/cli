import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  password,
  spinner,
} from "@clack/prompts";

import { styledTitle } from "./theme.js";

export type StyledClack = {
  log: {
    info(message: string): void;
    error(message: string): void;
    step(message: string): void;
    success(message: string): void;
    warn(message: string): void;
  };
  intro(title: string): void;
  note(message?: string, title?: string): void;
  outro(message: string): void;
  cancel(message: string): void;
  confirm(opts: { message: string }): Promise<boolean | symbol>;
  password(opts: { message: string }): Promise<string | symbol>;
  isCancel(value: unknown): value is symbol;
  spinner(): {
    start(message: string): void;
    message(message: string): void;
    stop(message: string): void;
    error(message: string): void;
  };
};

export function createStyledClack(): StyledClack {
  return {
    log,
    note,
    outro,
    cancel,
    confirm,
    password,
    isCancel,
    spinner,
    intro(title: string) {
      intro(styledTitle(title));
    },
  };
}
