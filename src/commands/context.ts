import type { Command } from "commander";
import { errorMessage } from "~/core/errors.js";
import { authMessages } from "~/core/messages/index.js";
import { getConfigDir } from "~/core/paths.js";
import { requireApiKey } from "~/domains/auth/index.js";
import {
  createLoggingSystem,
  defaultLogPath,
  resolveStderrLevel,
  type LoggingSystem,
} from "~/shell/logger.js";
import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import {
  type OutputFlags,
  detectOutputMode,
  isInteractive,
} from "~/shell/ui/env.js";
import { createUI } from "~/shell/ui/index.js";
import type {
  AuthCommandContext,
  CommandContext,
  CommandResult,
} from "~/shell/commandContext.js";

type ContextAction = (ctx: CommandContext) => Promise<CommandResult>;
type AuthContextAction = (ctx: AuthCommandContext) => Promise<CommandResult>;

type GlobalFlags = OutputFlags & { verbose?: boolean };

export function buildBaseContext(
  command: Command,
  signals: SignalRegistry,
): {
  ctx: CommandContext;
  apiBaseUrl: string;
  loggingSystem: LoggingSystem;
} {
  const env = process.env;
  const flags = command.optsWithGlobals<GlobalFlags>();
  const outputMode = detectOutputMode({
    flags,
    env,
    stdoutIsTTY: Boolean(process.stdout.isTTY),
  });
  const stderrLevel =
    outputMode === "agent"
      ? "silent"
      : resolveStderrLevel(env, Boolean(flags.verbose));
  const loggingSystem = createLoggingSystem({
    stderrLevel,
    logPath: defaultLogPath(),
  });
  const apiBaseUrl =
    env["QAWOLF_API_URL"]?.replace(/\/+$/, "") || "https://app.qawolf.com";
  return {
    ctx: {
      ui: createUI(outputMode),
      configDir: getConfigDir(),
      outputMode,
      isInteractive: isInteractive({
        stdinIsTTY: Boolean(process.stdin.isTTY),
        env,
      }),
      apiBaseUrl,
      signals,
      log: (scope) => loggingSystem.createLogger(scope),
    },
    apiBaseUrl,
    loggingSystem,
  };
}

export function withContext(
  signals: SignalRegistry,
  fn: ContextAction,
): (opts: unknown, command: Command) => Promise<void> {
  return async (_opts: unknown, command: Command): Promise<void> => {
    const { ctx, loggingSystem } = buildBaseContext(command, signals);
    try {
      const result = await fn(ctx);
      if (result !== undefined) {
        ctx.ui.error(result.error);
        process.exitCode = result.exitCode ?? 1;
      }
    } catch (err: unknown) {
      ctx.ui.error(errorMessage(err));
      process.exitCode = 1;
    } finally {
      loggingSystem.flush();
    }
  };
}

export function withAuthContext(
  signals: SignalRegistry,
  fn: AuthContextAction,
  deps: {
    requireApiKey?: typeof requireApiKey;
    createPlatform?: typeof createPlatformClient;
  } = {},
): (opts: unknown, command: Command) => Promise<void> {
  return async (_opts: unknown, command: Command): Promise<void> => {
    const { ctx, apiBaseUrl, loggingSystem } = buildBaseContext(
      command,
      signals,
    );
    const resolved = await (deps.requireApiKey ?? requireApiKey)(
      ctx.configDir,
    ).catch((err: unknown) => {
      ctx.ui.error(authMessages.notAuthenticated, errorMessage(err));
      process.exitCode = 1;
      return undefined;
    });
    if (resolved === undefined) {
      loggingSystem.flush();
      return;
    }

    const platform = (deps.createPlatform ?? createPlatformClient)(
      resolved.key,
      { baseUrl: apiBaseUrl, fetch: globalThis.fetch, logger: ctx.log("trpc") },
    );

    try {
      const result = await fn({
        ...ctx,
        platform,
        apiKeySource: resolved.source,
      });
      if (result !== undefined) {
        ctx.ui.error(result.error);
        process.exitCode = result.exitCode ?? 1;
      }
    } catch (err: unknown) {
      ctx.ui.error(errorMessage(err));
      process.exitCode = 1;
    } finally {
      loggingSystem.flush();
    }
  };
}
