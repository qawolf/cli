import { authMessages } from "~/core/messages/index.js";
import { resolveApiKey as realResolveApiKey } from "~/domains/auth/index.js";
import type { ApiKeyResult } from "~/domains/auth/types.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { loginWithApiKey as realLoginWithApiKey } from "./loginApiKey.js";
import { loginWithDevice as realLoginWithDevice } from "./loginDevice.js";

type LoginDeps = {
  resolveApiKey?: (
    configDir: string,
    fs: CommandContext["fs"],
  ) => Promise<ApiKeyResult | undefined>;
  loginWithApiKey?: (ctx: CommandContext) => Promise<CommandResult>;
  loginWithDevice?: (ctx: CommandContext) => Promise<CommandResult>;
};

const browserMethod = "browser";

export async function handleLogin(
  ctx: CommandContext,
  deps: LoginDeps = {},
): Promise<CommandResult> {
  if (ctx.ui.mode !== "human") {
    ctx.ui.error(authMessages.login.nonInteractive);
    return { error: "non-interactive" };
  }

  const resolveApiKey = deps.resolveApiKey ?? realResolveApiKey;
  const existing = await resolveApiKey(ctx.configDir, ctx.fs);
  if (existing) {
    const reauth = await ctx.ui.confirm(authMessages.login.reAuthPrompt);
    if (!reauth.ok || !reauth.value) {
      ctx.ui.info(authMessages.alreadyConfigured);
      return;
    }
  }

  ctx.ui.gap();
  ctx.ui.intro(authMessages.title);

  // The two credentials do not grant the same access — an API key carries team
  // scope a user token does not — so the choice is explicit rather than a
  // default that quietly narrows what later commands can do.
  const method = await ctx.ui.select(authMessages.login.chooseMethod, [
    {
      value: browserMethod,
      label: authMessages.login.methodBrowser,
      hint: authMessages.login.methodBrowserHint,
    },
    {
      value: "api-key",
      label: authMessages.login.methodApiKey,
      hint: authMessages.login.methodApiKeyHint,
    },
  ]);

  if (!method.ok) {
    ctx.ui.cancel(authMessages.cancelled);
    return;
  }

  if (method.value !== browserMethod) {
    return (deps.loginWithApiKey ?? realLoginWithApiKey)(ctx);
  }

  // Said before the flow starts rather than after it: the browser round trip
  // ends in "Signed in as ...", and a caveat printed after that reads as an
  // afterthought to a sign-in the person believes already took effect. A
  // previous browser session is simply replaced, so only an API key shadows.
  if (existing && existing.source !== "browser") {
    ctx.ui.warn(
      existing.source === "env"
        ? authMessages.login.apiKeyPrecedence.env
        : authMessages.login.apiKeyPrecedence.stored,
    );
  }

  return (deps.loginWithDevice ?? realLoginWithDevice)(ctx);
}
