import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
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
};

export type AuthCommandContext = CommandContext & {
  readonly platform: PlatformClient;
  readonly apiKeySource: string;
};

export type CommandResult = {
  readonly error: string;
  readonly exitCode?: number;
} | void;
