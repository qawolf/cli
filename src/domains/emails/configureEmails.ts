import type { configureEmailsClient, createEmailsClient } from "@qawolf/emails";

import { resolveFromEnvDir } from "~/shell/resolveExport.js";

type EmailsModule = {
  createEmailsClient: typeof createEmailsClient;
  configureEmailsClient: typeof configureEmailsClient;
};

// Loaded via resolveFromEnvDir + import() so the binary finds the package in
// the project's node_modules. Tests always inject deps.
async function loadSdkDeps(cwd: string): Promise<EmailsModule> {
  try {
    const emailsPath = resolveFromEnvDir(cwd, "@qawolf/emails");
    return (await import(emailsPath)) as EmailsModule;
  } catch (err) {
    throw new Error(
      "Could not load @qawolf/emails. Install it in your project: `npm install @qawolf/emails` or `bun add @qawolf/emails`.",
      { cause: err },
    );
  }
}

// Configure the emails client in platform-proxied mode: the client reaches the
// authenticated API at `${apiBaseUrl}/api/trpc/<proc>` using the CLI's API key
// and team id. createEmailsClient does no network I/O — it builds closures that
// fetch lazily when a flow reads mail.
export async function configureEmails(
  params: {
    apiBaseUrl: string;
    apiKey: string;
    teamId: string;
    cwd: string;
  },
  deps?: EmailsModule,
): Promise<void> {
  const { createEmailsClient, configureEmailsClient } =
    deps ?? (await loadSdkDeps(params.cwd));
  const client = await createEmailsClient({
    url: `${params.apiBaseUrl}/api`,
    apiKey: params.apiKey,
    teamId: params.teamId,
    pollForEmailsDefaultTimeoutMs: 300_000,
    waitForMessagesDefaultDelayMs: 15_000,
  });
  configureEmailsClient(client);
}
