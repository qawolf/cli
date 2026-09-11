import {
  autocomplete,
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  password,
  select,
  spinner,
  taskLog,
  text,
} from "@clack/prompts";

import { styledTitle } from "./theme.js";

export type StyledClack = {
  log: {
    /**
     * A line clack frames but does not classify. Takes the guide rail and a
     * symbol of the caller's choosing, and prefixes every line after the first
     * with the rail, so a message running to several lines reads as one thing.
     */
    message(message: string[], opts: { symbol: string }): void;
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
  confirm(opts: {
    message: string;
    initialValue?: boolean;
  }): Promise<boolean | symbol>;
  password(opts: { message: string }): Promise<string | symbol>;
  text(opts: {
    message: string;
    placeholder?: string;
  }): Promise<string | symbol>;
  autocomplete(opts: {
    message: string;
    options: { value: string; label: string; hint?: string }[];
    placeholder?: string;
    maxItems?: number;
    /** Option shape is clack's, where every field but `value` is optional. */
    filter?: (
      search: string,
      option: { value: string; label?: string; hint?: string },
    ) => boolean;
  }): Promise<string | symbol>;
  select(opts: {
    message: string;
    options: { value: string; label: string; hint?: string }[];
    initialValue?: string;
  }): Promise<string | symbol>;
  isCancel(value: unknown): value is symbol;
  spinner(): {
    start(message: string): void;
    message(message: string): void;
    stop(message: string): void;
    error(message: string): void;
  };
  taskLog(opts: { title: string; limit?: number }): {
    message(text: string): void;
    success(message: string): void;
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
    text,
    autocomplete,
    select,
    isCancel,
    spinner,
    taskLog,
    intro(title: string) {
      intro(styledTitle(title));
    },
  };
}
