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

export async function configureEmails(
  apiBaseUrl: string,
  cwd: string,
  deps?: EmailsModule,
): Promise<void> {
  const { createEmailsClient, configureEmailsClient } =
    deps ?? (await loadSdkDeps(cwd));
  const client = await createEmailsClient({
    emailerUrl: apiBaseUrl,
    pollForEmailsDefaultTimeoutMs: 60_000,
    waitForMessagesDefaultDelayMs: 1_000,
  });
  configureEmailsClient(client);
}
