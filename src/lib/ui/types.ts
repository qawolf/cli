import type { OutputMode } from "./env.js";
import type { PromptResult } from "./renderers/types.js";
import type { WithProgressFn } from "./renderers/withProgress.js";

export interface UI {
  readonly mode: OutputMode;

  // layout
  gap(): void;

  // flow
  intro(title: string): void;
  note(message: string, title?: string): void;
  outro(message: string): void;
  confirm(message: string): Promise<PromptResult<boolean>>;
  password(message: string, hint?: string): Promise<PromptResult<string>>;
  withProgress: WithProgressFn;
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
