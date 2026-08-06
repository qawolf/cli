import type { Mock } from "bun:test";
import type { RunFile } from "@qawolf/api-contracts/v1";

import { makeCtx } from "~/shell/commandContext.testUtils.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";
import { makeRunnerStore } from "~/shell/interactiveRunner/runnerStore.js";
import type {
  AuthCommandContext,
  CommandContext,
} from "~/shell/commandContext.js";
import type { OutputMode } from "~/shell/ui/env.js";

import type { InteractiveRunnerDeps } from "./deps.js";

export const testCwd = "/workspace";

export function makeAuthCtx(mode: OutputMode = "human"): {
  callPublicApi: ReturnType<typeof makeCallPublicApiMock>;
  ctx: AuthCommandContext;
  outputs: () => { data: unknown; humanMessage: string }[];
  streamed: () => string[];
  streamedData: () => unknown[];
  warnings: () => string[];
} {
  const callPublicApi = makeCallPublicApiMock();
  const base: CommandContext = makeCtx(mode);
  return {
    callPublicApi,
    ctx: {
      ...base,
      apiKeySource: "env",
      platformClient: makeMockPlatformClient({ callPublicApi }),
    },
    outputs: () =>
      (
        base.ui.output as Mock<(data: unknown, humanMessage: string) => void>
      ).mock.calls.map(([data, humanMessage]) => ({ data, humanMessage })),
    streamed: () => streamCalls(base).map(([, line]) => line),
    streamedData: () => streamCalls(base).map(([data]) => data),
    warnings: () =>
      (base.ui.warn as Mock<(message: string) => void>).mock.calls.map(
        ([message]) => message,
      ),
  };
}

function streamCalls(base: CommandContext): [unknown, string][] {
  return (base.ui.stream as Mock<(data: unknown, line: string) => void>).mock
    .calls;
}

export function makeTestDeps(
  overrides: Partial<InteractiveRunnerDeps> = {},
): InteractiveRunnerDeps {
  const files: RunFile[] = [
    { content: "{}", path: "package.json" },
    { content: "export default {};", path: "flow.ts" },
  ];
  return {
    collectRunFiles: async () => files,
    cwd: testCwd,
    env: {},
    makeRunnerId: () => "cli-minted",
    sleep: async () => {},
    store: makeRunnerStore({ cwd: testCwd, fs: makeMemoryFs() }),
    ...overrides,
  };
}
