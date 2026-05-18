import type { OutputMode } from "~/shell/ui/env.js";
import type { UI } from "~/shell/ui/index.js";

export type CommandContext = {
  readonly ui: UI;
  readonly configDir: string;
  readonly outputMode: OutputMode;
  readonly isInteractive: boolean;
  readonly apiBaseUrl: string;
};

export type CommandResult = {
  readonly error: string;
  readonly exitCode?: number;
} | void;
