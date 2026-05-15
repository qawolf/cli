import type { EmailsClient, EmailsClientOptions } from "@qawolf/emails";

type ConfigureEmailsDeps = {
  createEmailsClient: (opts: EmailsClientOptions) => Promise<EmailsClient>;
  configureEmailsClient: (client: EmailsClient) => void;
};

// Dynamic import prevents @qawolf/emailer-types from loading at module init
// time. That package calls .merge() on a refined zod schema at module level,
// which zod@4.4.2 throws on. Tests always inject deps, so this path only runs
// in production where the compatible SDK environment is assumed.
async function loadSdkDeps(): Promise<ConfigureEmailsDeps> {
  const sdk = await import("@qawolf/emails");
  return {
    createEmailsClient: sdk.createEmailsClient,
    configureEmailsClient: sdk.configureEmailsClient,
  };
}

export async function configureEmails(
  apiBaseUrl: string,
  deps?: ConfigureEmailsDeps,
): Promise<void> {
  const { createEmailsClient, configureEmailsClient } =
    deps ?? (await loadSdkDeps());
  const client = await createEmailsClient({
    emailerUrl: apiBaseUrl,
    pollForEmailsDefaultTimeoutMs: 60_000,
    waitForMessagesDefaultDelayMs: 1_000,
  });
  configureEmailsClient(client);
}
