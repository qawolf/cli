import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { Fs } from "~/shell/fs.js";
import type { Logger } from "~/shell/logger.js";
import type { OutputMode } from "~/shell/ui/env.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import type { UI } from "~/shell/ui/index.js";

export type CommandContext = {
  readonly ui: UI;
  readonly configDir: string;
  readonly outputMode: OutputMode;
  readonly isInteractive: boolean;
  readonly apiBaseUrl: string;
  readonly signals: SignalRegistry;
  readonly log: (scope: string) => Logger;
  readonly fs: Fs;
};

export type AuthCommandContext = CommandContext & {
  readonly platformClient: PlatformClient;
  readonly apiKeySource: string;
};

export type RunnerApiContext = Pick<AuthCommandContext, "platformClient">;

export type CommandResult = {
  readonly error: string;
  /** Multi-line detail rendered under the error (json mode emits it as `body`). */
  readonly errorBody?: string;
  readonly exitCode?: number;
} | void;
