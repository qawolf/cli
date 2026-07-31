import type {
  EmailsClient,
  configureEmailsClient,
  createEmailsClient,
} from "@qawolf/emails";

import { importFromPath } from "~/shell/importFromPath.js";
import { resolveFromEnvDir } from "~/shell/resolveExport.js";
import { packageLoadFailed } from "~/core/messages/index.js";
import { errorMessage } from "~/core/errors.js";

type EmailsModule = {
  createEmailsClient: typeof createEmailsClient;
  configureEmailsClient: typeof configureEmailsClient;
};

// How to reach the emailer: either through the authenticated Apex API
// (preferred — the CLI is already logged in to app.qawolf.com, where the test
// accounts' inboxes live) or a direct emailer URL (for environments that
// expose one without auth).
export type EmailsConfig =
  | { apiKey: string; url: string; teamId?: string }
  | { emailerUrl: string; teamId?: string };

// Loaded via resolveFromEnvDir + import() so the binary finds the package in
// the project's node_modules. Tests always inject deps.
async function loadSdkDeps(cwd: string): Promise<EmailsModule> {
  try {
    const emailsPath = resolveFromEnvDir(cwd, "@qawolf/emails");
    return (await importFromPath(emailsPath)) as EmailsModule;
  } catch (err) {
    throw new Error(
      packageLoadFailed("@qawolf/emails", cwd, errorMessage(err)),
      { cause: err },
    );
  }
}

export async function configureEmails(
  config: EmailsConfig,
  cwd: string,
  deps?: EmailsModule,
): Promise<Awaited<ReturnType<typeof createEmailsClient>>> {
  const { createEmailsClient, configureEmailsClient } =
    deps ?? (await loadSdkDeps(cwd));
  const client = await createEmailsClient({
    ...config,
    pollForEmailsDefaultTimeoutMs: 60_000,
    waitForMessagesDefaultDelayMs: 1_000,
  });
  // Configure the module-global client so flows that call `mail.inbox()` work,
  // and return it so the runner can also inject `getInbox` as a flow dep.
  configureEmailsClient(client);
  return client;
}

// Eagerly register a lazy client as the module-global so flows that call
// `mail.inbox()` (which reads the global client) resolve through `getInbox`
// even when they never call the getInbox run-global dep. No network here — the
// lazy `getInbox` defers credential resolution to its first invocation.
export async function registerLazyEmailsClient(
  getInbox: EmailsClient["getInbox"],
  cwd: string,
  deps?: EmailsModule,
): Promise<void> {
  const { configureEmailsClient } = deps ?? (await loadSdkDeps(cwd));
  configureEmailsClient({ getInbox });
}
