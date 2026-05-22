import type { configureEmailsClient, createEmailsClient } from "@qawolf/emails";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type EmailsModule = {
  createEmailsClient: typeof createEmailsClient;
  configureEmailsClient: typeof configureEmailsClient;
};

// Loaded via import.meta.resolve so the binary finds the package in the
// project's node_modules rather than alongside the CLI binary. The base URL
// points to a file inside cwd (not the directory itself) because pathToFileURL
// on a directory produces a URL without trailing slash, which import.meta.resolve
// treats as a file — causing lookup to start from the parent directory instead.
// Tests always inject deps so this path only runs in production.
async function loadSdkDeps(cwd: string): Promise<EmailsModule> {
  const base = pathToFileURL(join(cwd, "package.json"));
  try {
    return (await import(
      import.meta.resolve("@qawolf/emails", base)
    )) as EmailsModule;
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
