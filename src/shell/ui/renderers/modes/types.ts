import type { WithProgressFn } from "./progress.js";

type StepProgress = { current: number; total: number };

export type RendererSet = {
  intro(title: string): void;
  note(message: string, title?: string): void;
  outro(message: string): void;
  cancel(message: string): void;
  step(message: string, progress?: StepProgress): void;
  success(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  error(title: string, body?: string): void;
  output(data: unknown, humanMessage: string): void;
  gap(): void;
  /**
   * One line of primary command data to stdout, in every output mode.
   *
   * Apart from `write`, which is decoration and so goes to stderr where an agent
   * reads it and nowhere at all in json mode. A streamed journal line is the
   * answer to the command, and `qawolf runner events recorder | jq` has to see it
   * whether a terminal, a pipe or a harness is on the other end.
   */
  stream(line: string): void;
  write(text: string): void;
  withProgress: WithProgressFn;
};
