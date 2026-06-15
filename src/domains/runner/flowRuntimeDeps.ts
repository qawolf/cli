import type { EmailsClient } from "@qawolf/emails";

export type FlowRuntimeDeps = {
  readonly getInbox?: EmailsClient["getInbox"];
  readonly setEnvironmentVariable?: (
    key: string,
    value: string,
  ) => Promise<void>;
  readonly fetchLatestEnvironmentVariables?: () => Promise<void>;
};
