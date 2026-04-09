import {
  cancel,
  intro,
  isCancel,
  log,
  note,
  outro,
  password,
  spinner,
} from "@clack/prompts";

import { styledTitle } from "./theme.js";

export interface StyledClack {
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
  password(opts: { message: string }): Promise<string | symbol>;
  isCancel(value: unknown): value is symbol;
  spinner(): {
    start(message: string): void;
    message(message: string): void;
    stop(message: string): void;
  };
}

export function createStyledClack(): StyledClack {
  return {
    log,
    note,
    outro,
    cancel,
    password,
    isCancel,
    spinner,
    intro(title: string) {
      intro(styledTitle(title));
    },
  };
}
