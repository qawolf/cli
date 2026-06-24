import { resolveApiKey } from "~/domains/auth/index.js";
import { configureEmails as defaultConfigureEmails } from "~/domains/emails/configureEmails.js";
import type { Fs } from "~/shell/fs.js";
import { getIdentity } from "~/shell/platform/getIdentity.js";
import type { CommandContext } from "~/shell/commandContext.js";

export type ConfigureEmailsOutcome =
  | "configured"
  | "skipped-not-authenticated"
  | "skipped-identity-unavailable"
  | "skipped-emails-unavailable";

type ConfigureEmailsForRunDeps = {
  resolveApiKey: typeof resolveApiKey;
  getIdentity: typeof getIdentity;
  configureEmails: typeof defaultConfigureEmails;
};

function makeDefaultDeps(): ConfigureEmailsForRunDeps {
  return {
    resolveApiKey,
    getIdentity,
    configureEmails: defaultConfigureEmails,
  };
}

// Resolve credentials and register the emails client for the current process.
// Total: any failure degrades gracefully to a "skipped-*" outcome so a run is
// never broken by email setup. Email-dependent flows that need a client and did
// not get one surface @qawolf/emails' own clear error at mail.inbox() time.
export async function configureEmailsForRun(
  params: {
    apiBaseUrl: string;
    configDir: string;
    cwd: string;
    fs: Fs;
    log: ((message: string) => void) | undefined;
  },
  deps?: ConfigureEmailsForRunDeps,
): Promise<ConfigureEmailsOutcome> {
  const resolvedDeps = deps ?? makeDefaultDeps();
  const log = params.log ?? ((): void => undefined);

  const apiKey = await resolvedDeps.resolveApiKey(params.configDir, params.fs);
  if (apiKey === undefined) {
    log("emails: skipped — not authenticated");
    return "skipped-not-authenticated";
  }

  const identity = await resolvedDeps.getIdentity(apiKey.key, {
    fetch: globalThis.fetch,
    baseUrl: params.apiBaseUrl,
  });
  if (!identity.ok) {
    log(`emails: skipped — team identity unavailable (${identity.error.kind})`);
    return "skipped-identity-unavailable";
  }

  try {
    await resolvedDeps.configureEmails({
      apiBaseUrl: params.apiBaseUrl,
      apiKey: apiKey.key,
      teamId: identity.data.team.id,
      cwd: params.cwd,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    log(`emails: skipped — client unavailable (${detail})`);
    return "skipped-emails-unavailable";
  }

  log("emails: configured");
  return "configured";
}

// In-process (`--workers 1`) convenience over configureEmailsForRun: pulls
// credentials from the command context. No-op for pooled runs — the worker
// entry configures those processes itself.
export async function configureEmailsForInProcessRun(
  ctx: CommandContext,
  cwd: string,
  workers: number,
): Promise<void> {
  if (workers !== 1) return;
  await configureEmailsForRun({
    apiBaseUrl: ctx.apiBaseUrl,
    configDir: ctx.configDir,
    cwd,
    fs: ctx.fs,
    log: (message) => ctx.log("emails").debug(message),
  });
}
