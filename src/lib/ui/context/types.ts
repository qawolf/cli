import type { OutputMode } from "../env.js";

export type PromptResult<T> = { ok: true; value: T } | { ok: false };

export interface ProgressStep {
  message: string;
  task: () => Promise<unknown>;
}

export type WithProgressDone = string | ((results: unknown[]) => string);

export interface UIContext {
  readonly mode: OutputMode;

  // layout
  gap(): void;

  // flow
  intro(title: string): void;
  note(message: string, title?: string): void;
  outro(message: string): void;
  password(message: string): Promise<PromptResult<string>>;
  withProgress(
    steps: ProgressStep[],
    done: WithProgressDone,
  ): Promise<unknown[]>;
  step(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  cancel(message: string): void;

  // data
  json(data: unknown): void;
  output(data: unknown, humanMessage: string): void;

  // diagnostics
  error(title: string, body?: string): void;
  info(message: string): void;
}
