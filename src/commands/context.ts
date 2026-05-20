import type { Command } from "commander";
import { errorMessage } from "~/core/errors.js";
import { getConfigDir } from "~/core/paths.js";
import { requireApiKey } from "~/domains/auth/index.js";
import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";
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

function buildBaseContext(command: Command): {
  ctx: CommandContext;
  apiBaseUrl: string;
} {
  const env = process.env;
  const outputMode = detectOutputMode({
    flags: command.optsWithGlobals<OutputFlags>(),
    env,
    stdoutIsTTY: Boolean(process.stdout.isTTY),
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
    },
    apiBaseUrl,
  };
}

export function withContext(
  fn: ContextAction,
): (opts: unknown, command: Command) => Promise<void> {
  return async (_opts: unknown, command: Command): Promise<void> => {
    const { ctx } = buildBaseContext(command);
    try {
      const result = await fn(ctx);
      if (result !== undefined) {
        ctx.ui.error(result.error);
        process.exitCode = result.exitCode ?? 1;
      }
    } catch (err: unknown) {
      ctx.ui.error(errorMessage(err));
      process.exitCode = 1;
    }
  };
}

export function withAuthContext(
  fn: AuthContextAction,
  deps: { requireApiKey?: typeof requireApiKey } = {},
): (opts: unknown, command: Command) => Promise<void> {
  return async (_opts: unknown, command: Command): Promise<void> => {
    const { ctx, apiBaseUrl } = buildBaseContext(command);
    const resolved = await (deps.requireApiKey ?? requireApiKey)(
      ctx.configDir,
    ).catch((err: unknown) => {
      ctx.ui.error("Not authenticated", errorMessage(err));
      process.exitCode = 1;
      return undefined;
    });
    if (resolved === undefined) return;

    const platform = createPlatformClient(resolved.key, {
      baseUrl: apiBaseUrl,
      fetch: globalThis.fetch,
    });
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
    }
  };
}
