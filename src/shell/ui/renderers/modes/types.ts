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
  write(text: string): void;
  withProgress: WithProgressFn;
};
