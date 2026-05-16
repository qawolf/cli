import { createRequire } from "node:module";
import { join } from "node:path";
import type { EmailsClient, EmailsClientOptions } from "@qawolf/emails";

type ConfigureEmailsDeps = {
  createEmailsClient: (opts: EmailsClientOptions) => Promise<EmailsClient>;
  configureEmailsClient: (client: EmailsClient) => void;
};

// Loaded via createRequire from the env dir so the binary resolves the package
// from the project's node_modules, not from alongside the CLI binary. Tests
// always inject deps so this path only runs in production.
// Note: @qawolf/emailer-types calls .merge() on a zod schema at module level
// which zod@4.4.2 throws on — lazy loading (here vs. top-level import) avoids
// that crash.
function loadSdkDeps(cwd: string): ConfigureEmailsDeps {
  try {
    const requireFrom = createRequire(join(cwd, "package.json"));
    const { createEmailsClient, configureEmailsClient } = requireFrom(
      "@qawolf/emails",
    ) as ConfigureEmailsDeps;
    return { createEmailsClient, configureEmailsClient };
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
  deps?: ConfigureEmailsDeps,
): Promise<void> {
  const { createEmailsClient, configureEmailsClient } =
    deps ?? loadSdkDeps(cwd);
  const client = await createEmailsClient({
    emailerUrl: apiBaseUrl,
    pollForEmailsDefaultTimeoutMs: 60_000,
    waitForMessagesDefaultDelayMs: 1_000,
  });
  configureEmailsClient(client);
}
